-- CDAC CMCE Prep: student profile table
-- Run this in Supabase Dashboard > SQL Editor.

create table if not exists public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

create policy "Students can read their own profile"
on public.student_profiles for select
to authenticated
using (auth.uid() = id);

create policy "Students can insert their own profile"
on public.student_profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "Students can update their own profile"
on public.student_profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email
  )
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
