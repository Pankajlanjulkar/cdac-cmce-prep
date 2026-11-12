-- Referral programme: five verified new students earn one free full course.
-- Existing student_purchases is used for entitlements. Reward purchase amount is zero.
create table if not exists public.student_referral_codes (
  student_id uuid primary key references auth.users(id) on delete cascade,
  referral_code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.student_referrals (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_student_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  status text not null default 'qualified' check(status in ('qualified','rejected')),
  created_at timestamptz not null default now(),
  constraint no_self_referral check(referrer_id <> referred_student_id)
);
create index if not exists student_referrals_referrer_idx on public.student_referrals(referrer_id,status);

alter table public.student_referral_codes enable row level security;
alter table public.student_referrals enable row level security;
drop policy if exists "Students read own referral code" on public.student_referral_codes;
create policy "Students read own referral code" on public.student_referral_codes
 for select to authenticated using(student_id=auth.uid());
drop policy if exists "Students read referrals they sent" on public.student_referrals;
create policy "Students read referrals they sent" on public.student_referrals
 for select to authenticated using(referrer_id=auth.uid());
grant select on public.student_referral_codes, public.student_referrals to authenticated;
revoke all on public.student_referral_codes, public.student_referrals from anon, authenticated;
grant select on public.student_referral_codes, public.student_referrals to authenticated;

create or replace function public.get_or_create_referral_code()
returns text language plpgsql security definer set search_path='' as $$
declare v_code text; v_uid uuid := auth.uid();
begin
 if v_uid is null then raise exception 'Sign in required'; end if;
 select referral_code into v_code from public.student_referral_codes where student_id=v_uid;
 if v_code is null then
   v_code := upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
   insert into public.student_referral_codes(student_id,referral_code) values(v_uid,v_code)
   on conflict(student_id) do update set student_id=excluded.student_id
   returning referral_code into v_code;
 end if;
 return v_code;
end; $$;

create or replace function public.record_referral_signup(p_referral_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid := auth.uid(); v_referrer uuid; v_created timestamptz; v_verified timestamptz;
begin
 if v_uid is null then raise exception 'Sign in required'; end if;
 select created_at,email_confirmed_at into v_created,v_verified from auth.users where id=v_uid;
 if v_verified is null then return jsonb_build_object('recorded',false,'reason','Verify your email first'); end if;
 select student_id into v_referrer from public.student_referral_codes where referral_code=upper(trim(p_referral_code));
 if v_referrer is null or v_referrer=v_uid then return jsonb_build_object('recorded',false,'reason','Invalid referral code'); end if;
 -- Only accept accounts created after the referrer's code existed.
 if not exists(select 1 from public.student_referral_codes where student_id=v_referrer and created_at<=v_created) then
   return jsonb_build_object('recorded',false,'reason','Referral code was not active at signup');
 end if;
 insert into public.student_referrals(referrer_id,referred_student_id,referral_code)
 values(v_referrer,v_uid,upper(trim(p_referral_code)))
 on conflict(referred_student_id) do nothing;
 return jsonb_build_object('recorded',found,'reason',case when found then 'Referral counted' else 'This account has already used a referral' end);
end; $$;

create or replace function public.get_referral_summary()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_code text; v_count integer; v_claimed integer;
begin
 if v_uid is null then raise exception 'Sign in required'; end if;
 select referral_code into v_code from public.student_referral_codes where student_id=v_uid;
 select count(*) into v_count from public.student_referrals where referrer_id=v_uid and status='qualified';
 select count(*) into v_claimed from public.student_purchases where student_id=v_uid and provider='referral_reward' and status='active';
 return jsonb_build_object('referral_code',v_code,'successful_referrals',v_count,'reward_claimed',v_claimed>0,'eligible',v_count>=5 and v_claimed=0);
end; $$;

create or replace function public.claim_referral_course_reward(p_course_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_count integer; v_exists boolean;
begin
 if v_uid is null then raise exception 'Sign in required'; end if;
 select count(*) into v_count from public.student_referrals where referrer_id=v_uid and status='qualified';
 select exists(select 1 from public.student_purchases where student_id=v_uid and provider='referral_reward' and status='active') into v_exists;
 if v_count<5 then raise exception 'You need five successful verified referrals'; end if;
 if v_exists then raise exception 'Referral reward has already been claimed'; end if;
 if p_course_code is null or upper(trim(p_course_code)) not in ('PGCP-AC','PGCP-MC','PGCP-VLSI','PGCP-ESD','PGCP-AI','PGCP-BDA') then
   raise exception 'Please select one of the six supported programmes';
 end if;
 insert into public.student_purchases(student_id,course_code,module_index,access_type,amount_inr,status,provider,provider_reference)
 values(v_uid,upper(trim(p_course_code)),null,'course',0,'active','referral_reward','referral-'||v_uid::text);
 return jsonb_build_object('success',true,'course_code',upper(trim(p_course_code)));
end; $$;

revoke all on function public.get_or_create_referral_code() from public,anon;
revoke all on function public.record_referral_signup(text) from public,anon;
revoke all on function public.get_referral_summary() from public,anon;
revoke all on function public.claim_referral_course_reward(text) from public,anon;
grant execute on function public.get_or_create_referral_code() to authenticated;
grant execute on function public.record_referral_signup(text) to authenticated;
grant execute on function public.get_referral_summary() to authenticated;
grant execute on function public.claim_referral_course_reward(text) to authenticated;
