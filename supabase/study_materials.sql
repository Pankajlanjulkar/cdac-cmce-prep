-- Premium study materials: private metadata + entitlement-gated access.
-- Run in Supabase SQL Editor. Create a PRIVATE Storage bucket named study-materials.
create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,
  course_name text not null,
  module_index integer not null,
  module_name text not null,
  title text not null,
  storage_path text not null unique,
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.study_materials enable row level security;
drop policy if exists "Premium students can view purchased study material metadata" on public.study_materials;
create policy "Premium students can view purchased study material metadata"
on public.study_materials for select to authenticated
using (
  is_published = true
  and public.has_premium_access(course_code, module_index)
);
revoke all on public.study_materials from anon;
grant select on public.study_materials to authenticated;
-- No browser role receives Storage object access. Only the edge function service role reads files.
