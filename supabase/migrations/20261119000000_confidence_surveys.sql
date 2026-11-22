-- Baseline and periodic confidence check-ins (spec F-03, F-05; evidence for problem P1).

create table public.confidence_surveys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('baseline', 'periodic')),
  -- Which questionnaire and version produced these answers (wording may change later).
  instrument text not null check (char_length(instrument) <= 40),
  -- Answers in question order, each 1..5. Shape validated in the app (Zod) and here.
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 40),
  created_at timestamptz not null default now()
);

create index confidence_surveys_user_idx on public.confidence_surveys (user_id, created_at desc);

alter table public.confidence_surveys enable row level security;

create policy "confidence_surveys: owner can read"
  on public.confidence_surveys for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "confidence_surveys: owner can add"
  on public.confidence_surveys for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- No update/delete: answers are an append-only history.
