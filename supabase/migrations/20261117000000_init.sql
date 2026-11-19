-- Phase 0 baseline: shared helpers, profiles, consents, background job queue.
-- Rule (CLAUDE.md): every user-owned table has RLS enabled with owner-only policies.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users, created automatically on sign-up)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  university text check (char_length(university) <= 160),
  field_of_study text check (char_length(field_of_study) <= 80),
  goals text[] not null default '{}',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: owner can update"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Consents (append-only history; spec F-04)
-- ---------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('analysis', 'age_18_plus', 'save_video_default', 'study_participation')),
  granted boolean not null,
  policy_version text not null check (char_length(policy_version) <= 20),
  created_at timestamptz not null default now()
);

create index consents_user_kind_idx on public.consents (user_id, kind, created_at desc);

alter table public.consents enable row level security;

create policy "consents: owner can read"
  on public.consents for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "consents: owner can add"
  on public.consents for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- No update/delete policies: consent history is append-only.

-- ---------------------------------------------------------------------------
-- Background jobs (Postgres-backed queue; architecture §2)
-- Users can read their own jobs; only enqueue_job() can create them.
-- The worker connects with a privileged role and bypasses RLS.
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_queue_idx on public.jobs (run_after, created_at) where status = 'queued';
create index jobs_user_idx on public.jobs (user_id, created_at desc);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;

create policy "jobs: owner can read"
  on public.jobs for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.enqueue_job(p_kind text, p_payload jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Allow-list of job kinds users may request directly. Extend as features ship.
  if p_kind not in ('ping') then
    raise exception 'job kind % not allowed', p_kind using errcode = '22023';
  end if;
  if pg_column_size(p_payload) > 16384 then
    raise exception 'payload too large' using errcode = '22023';
  end if;

  insert into public.jobs (user_id, kind, payload)
  values (auth.uid(), p_kind, coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.enqueue_job(text, jsonb) from public, anon;
grant execute on function public.enqueue_job(text, jsonb) to authenticated;

-- Live job progress in the browser (Realtime respects RLS).
alter publication supabase_realtime add table public.jobs;
