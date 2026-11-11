-- Performance indexes for frequent premium-access checks.
-- Run once in Supabase Dashboard > SQL Editor.
-- Safe to re-run.
create index if not exists idx_student_purchases_active_lookup
on public.student_purchases (student_id, course_code, access_type, module_index)
where status = 'active';
