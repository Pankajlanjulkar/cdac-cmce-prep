-- One active device session per student account.
-- Run in Supabase Dashboard > SQL Editor before deploying the updated auth.js.
create table if not exists public.student_device_sessions (
  student_id uuid primary key references auth.users(id) on delete cascade,
  device_id text not null,
  last_seen_at timestamptz not null default now()
);
alter table public.student_device_sessions enable row level security;
revoke all on public.student_device_sessions from anon, authenticated;

create or replace function public.claim_student_device(p_device_id text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or p_device_id is null or length(p_device_id) < 20 or length(p_device_id) > 100 then return false; end if;
  insert into public.student_device_sessions(student_id, device_id, last_seen_at)
  values (v_uid, p_device_id, now())
  on conflict (student_id) do update set device_id = excluded.device_id, last_seen_at = now();
  return true;
end;
$$;

create or replace function public.check_student_device(p_device_id text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then return false; end if;
  update public.student_device_sessions set last_seen_at = now()
  where student_id = v_uid and device_id = p_device_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

create or replace function public.release_student_device(p_device_id text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then return false; end if;
  delete from public.student_device_sessions where student_id = v_uid and device_id = p_device_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.claim_student_device(text) from public, anon;
revoke all on function public.check_student_device(text) from public, anon;
revoke all on function public.release_student_device(text) from public, anon;
grant execute on function public.claim_student_device(text) to authenticated;
grant execute on function public.check_student_device(text) to authenticated;
grant execute on function public.release_student_device(text) to authenticated;
