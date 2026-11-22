-- Projects, slide decks and extracted slides (spec F-10, F-11, F-12, F-13).

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  preset text not null check (preset in ('class', 'fyp_viva', 'pitch', 'custom')),
  time_limit_s integer not null check (time_limit_s between 60 and 900),
  present_on date,
  audience text check (audience in ('examiners', 'classmates', 'industry', 'public')),
  qa_enabled boolean not null default true,
  script_style text not null default 'key_points' check (script_style in ('key_points', 'full')),
  tone text not null default 'formal' check (tone in ('formal', 'conversational')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_idx on public.projects (user_id, status, updated_at desc);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy "projects: owner can read" on public.projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "projects: owner can create" on public.projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "projects: owner can update" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "projects: owner can delete" on public.projects
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Decks (one row per uploaded file; a re-upload creates a new version)
-- Users create the row after uploading; only the worker changes status.
-- ---------------------------------------------------------------------------
create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  version integer not null default 1,
  source_path text not null check (char_length(source_path) <= 400),
  original_filename text not null check (char_length(original_filename) <= 255),
  file_size bigint not null check (file_size > 0 and file_size <= 104857600),
  mime_type text not null check (mime_type in ('application/pdf')),
  page_count integer,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version)
);

create index decks_project_idx on public.decks (project_id, version desc);

create trigger decks_set_updated_at
  before update on public.decks
  for each row execute function public.set_updated_at();

alter table public.decks enable row level security;

create policy "decks: owner can read" on public.decks
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "decks: owner can register an upload" on public.decks
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'uploaded'
    and page_count is null
    and error_code is null
    -- the file must live under the user's own folder for this project
    and source_path like (select auth.uid())::text || '/' || project_id::text || '/%'
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Slides (written by the worker; read by the owner)
-- ---------------------------------------------------------------------------
create table public.slides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id uuid not null references public.decks (id) on delete cascade,
  index integer not null check (index >= 1),
  title text,
  body_text text not null default '',
  notes text not null default '',
  visual_count integer not null default 0,
  image_path text,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (deck_id, index)
);

alter table public.slides enable row level security;

create policy "slides: owner can read" on public.slides
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Job queue: allow deck ingestion, only for the caller's own decks
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
-- Storage: private buckets with per-user folders ("<user_id>/<project_id>/...")
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('decks', 'decks', false, 104857600, array['application/pdf']),
  ('slide-images', 'slide-images', false, 5242880, array['image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "decks bucket: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'decks' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "decks bucket: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'decks' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "decks bucket: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'decks' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "slide images: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'slide-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
