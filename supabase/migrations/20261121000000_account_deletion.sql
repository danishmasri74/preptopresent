-- Self-service account deletion (spec F-06, architecture §8).
--
-- Flow: the user confirms in Settings → request_account_deletion() marks the profile and queues a
-- `delete_account` job → the app signs the user out → the worker removes every stored file under
-- the user's folder, then deletes the auth user, which cascades to every user-owned row
-- (including the job row itself).

alter table public.profiles
  add column deletion_requested_at timestamptz;

comment on column public.profiles.deletion_requested_at is
  'Set when the user asks to delete their account. The app signs them out while it is set; the delete_account job removes the account shortly after.';

create or replace function public.request_account_deletion()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.profiles
     set deletion_requested_at = coalesce(deletion_requested_at, now())
   where id = v_uid;

  -- Idempotent: a double click or a retry reuses the pending job.
  select id into v_id
    from public.jobs
   where user_id = v_uid and kind = 'delete_account' and status in ('queued', 'running')
   limit 1;

  if v_id is null then
    insert into public.jobs (user_id, kind, payload, max_attempts)
    values (v_uid, 'delete_account', jsonb_build_object('user_id', v_uid), 5)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
