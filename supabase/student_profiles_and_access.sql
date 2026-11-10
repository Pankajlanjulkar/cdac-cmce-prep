-- CDAC CMCE Prep: student profiles and premium entitlements
-- Run once in Supabase Dashboard > SQL Editor.
-- Safe to re-run: tables, policies, trigger and function are recreated idempotently.

create table if not exists public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

drop policy if exists "Students can read their own profile" on public.student_profiles;
create policy "Students can read their own profile"
on public.student_profiles for select to authenticated
using (auth.uid() = id);

drop policy if exists "Students can insert their own profile" on public.student_profiles;
create policy "Students can insert their own profile"
on public.student_profiles for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "Students can update their own profile" on public.student_profiles;
create policy "Students can update their own profile"
on public.student_profiles for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_student on auth.users;
create trigger on_auth_user_created_student
after insert on auth.users
for each row execute procedure public.handle_new_student();

-- Purchase records are written only by trusted server/admin workflows.
-- Browser clients may read only their own active purchase records.
create table if not exists public.student_purchases (
  id bigint generated always as identity primary key,
  student_id uuid not null references auth.users(id) on delete cascade,
  course_code text not null,
  module_index integer,
  access_type text not null check (access_type in ('course','module')),
  amount_inr integer not null check (amount_inr >= 0),
  status text not null default 'pending' check (status in ('pending','active','refunded','cancelled')),
  provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

alter table public.student_purchases enable row level security;
drop policy if exists "Students can read their own purchases" on public.student_purchases;
create policy "Students can read their own purchases"
on public.student_purchases for select to authenticated
using (auth.uid() = student_id);

revoke insert, update, delete on public.student_purchases from anon, authenticated;
grant select on public.student_purchases to authenticated;

create or replace function public.has_premium_access(
  requested_course_code text,
  requested_module_index integer default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_purchases p
    where p.student_id = auth.uid()
      and p.status = 'active'
      and p.course_code = requested_course_code
      and (
        p.access_type = 'course'
        or (p.access_type = 'module' and p.module_index = requested_module_index)
      )
  );
$$;

revoke all on function public.has_premium_access(text, integer) from public, anon;
grant execute on function public.has_premium_access(text, integer) to authenticated;
