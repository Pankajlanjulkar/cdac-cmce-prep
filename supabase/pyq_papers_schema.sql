-- PYQ catalogue. Only papers with documented redistribution permission should be uploaded and published.
create table if not exists public.pyq_papers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  programme text not null,
  subject text,
  paper_year integer,
  storage_path text not null unique,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.pyq_papers enable row level security;
revoke all on public.pyq_papers from anon, authenticated;
-- Reads and PDF delivery are performed only by the view-pyq-paper Edge Function using service role.
