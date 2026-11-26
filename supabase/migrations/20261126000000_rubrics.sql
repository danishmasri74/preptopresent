-- Marking rubrics and their parsed criteria (spec F-14; review/editing is F-15).
--
-- Flow: the browser uploads the file to the private `rubrics` bucket (or pastes text), the
-- server registers a `rubrics` row and queues `parse_rubric`, and the worker extracts the text,
-- asks Claude for the criteria and writes `rubric_criteria`. A project can have several rubric
-- rows over time; the newest one is current.

-- ---------------------------------------------------------------------------
-- Rubrics
-- ---------------------------------------------------------------------------
create table public.rubrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  source_kind text not null check (source_kind in ('file', 'paste')),
  -- file uploads
  source_path text check (char_length(source_path) <= 400),
  original_filename text check (char_length(original_filename) <= 255),
  mime_type text check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp'
  )),
  file_size bigint check (file_size > 0 and file_size <= 20971520),
  -- pasted text
  pasted_text text check (char_length(pasted_text) between 1 and 20000),
  -- filled in by the worker
  raw_text text,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'parsed', 'confirmed', 'failed')),
  error_code text,
  weights_suggested boolean not null default false,
  model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rubrics_source_matches_kind check (
    (source_kind = 'file' and source_path is not null and original_filename is not null
       and mime_type is not null and file_size is not null and pasted_text is null)
    or
    (source_kind = 'paste' and pasted_text is not null and source_path is null)
  )
);

create index rubrics_project_idx on public.rubrics (project_id, created_at desc);

create trigger rubrics_set_updated_at
  before update on public.rubrics
  for each row execute function public.set_updated_at();

alter table public.rubrics enable row level security;

create policy "rubrics: owner can read" on public.rubrics
  for select to authenticated using ((select auth.uid()) = user_id);

-- Users only register new uploads; the worker sets everything after that.
create policy "rubrics: owner can register an upload" on public.rubrics
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'uploaded'
    and raw_text is null and error_code is null and model is null and prompt_version is null
    and weights_suggested = false
    and (source_path is null
         or source_path like (select auth.uid())::text || '/' || project_id::text || '/%')
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Rubric criteria (written by the worker; the user edits them on Rubric review, F-15)
-- Weights are percentages. They may not add up to 100 straight after parsing (the file said
-- so, or weights were suggested); confirming a rubric (F-15) requires a total of 100.
-- ---------------------------------------------------------------------------
create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rubric_id uuid not null references public.rubrics (id) on delete cascade,
  position integer not null check (position >= 1),
  name text not null check (char_length(name) between 1 and 120),
  weight numeric(5, 2) not null check (weight >= 0 and weight <= 100),
  description text not null default '' check (char_length(description) <= 2000),
  -- [{ "label": "Excellent", "text": "..." }, ...] from the rubric's level columns, if any
  levels jsonb not null default '[]'::jsonb check (jsonb_typeof(levels) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rubric_id, position)
);

create trigger rubric_criteria_set_updated_at
  before update on public.rubric_criteria
  for each row execute function public.set_updated_at();

alter table public.rubric_criteria enable row level security;

create policy "rubric criteria: owner can read" on public.rubric_criteria
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- AI usage log (architecture §7, §8): one row per successful AI call, for cost tracking.
-- Monthly allowances (F-07) will count these rows; until then they are only logged.
-- ---------------------------------------------------------------------------
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('script_draft', 'rubric_read', 'rehearsal_analysis', 'qa_drill')),
  job_id uuid references public.jobs (id) on delete set null,
  provider text not null check (char_length(provider) <= 40),
  model text not null check (char_length(model) <= 80),
  prompt_version text check (char_length(prompt_version) <= 60),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  audio_seconds numeric(10, 2),
  cost_usd numeric(10, 5),
  created_at timestamptz not null default now()
);

create index usage_events_user_month_idx on public.usage_events (user_id, action, created_at desc);

alter table public.usage_events enable row level security;

create policy "usage events: owner can read" on public.usage_events
  for select to authenticated using ((select auth.uid()) = user_id);
-- Append-only and written only by the worker: no insert/update/delete policies.

-- ---------------------------------------------------------------------------
-- Job queue: allow rubric parsing, only for the caller's own rubrics
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_job(p_kind text, p_payload jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if pg_column_size(p_payload) > 16384 then
    raise exception 'payload too large' using errcode = '22023';
  end if;

  if p_kind = 'ping' then
    null;
  elsif p_kind = 'ingest_deck' then
    if not exists (
      select 1 from public.decks d
      where d.id = (p_payload ->> 'deck_id')::uuid and d.user_id = v_uid
    ) then
      raise exception 'deck not found' using errcode = '22023';
    end if;
    p_payload := jsonb_build_object('deck_id', p_payload ->> 'deck_id');
  elsif p_kind = 'parse_rubric' then
    if not exists (
      select 1 from public.rubrics r
      where r.id = (p_payload ->> 'rubric_id')::uuid and r.user_id = v_uid
    ) then
      raise exception 'rubric not found' using errcode = '22023';
    end if;
    p_payload := jsonb_build_object('rubric_id', p_payload ->> 'rubric_id');
  else
    raise exception 'job kind % not allowed', p_kind using errcode = '22023';
  end if;

  insert into public.jobs (user_id, kind, payload)
  values (v_uid, p_kind, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private `rubrics` bucket with per-user folders ("<user_id>/<project_id>/...")
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rubrics', 'rubrics', false, 20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do nothing;

create policy "rubrics bucket: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'rubrics' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "rubrics bucket: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'rubrics' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "rubrics bucket: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'rubrics' and (storage.foldername(name))[1] = (select auth.uid())::text);
