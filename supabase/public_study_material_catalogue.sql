-- Allow everyone to see the published study-material catalogue.
-- This grants access to metadata only; PDF bytes remain private and are served
-- exclusively by view-study-material after authentication + entitlement check.
drop policy if exists "Anyone can view published study material catalogue" on public.study_materials;
create policy "Anyone can view published study material catalogue"
on public.study_materials
for select
to anon, authenticated
using (is_published = true);

grant select on public.study_materials to anon, authenticated;

-- Keep storage.objects private. Do not create public bucket or object policies.
