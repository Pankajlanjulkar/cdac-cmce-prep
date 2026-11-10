-- Add a unique payment ID for audit/reconciliation after Razorpay capture.
alter table public.student_purchases
  add column if not exists provider_payment_id text;
create unique index if not exists student_purchases_provider_payment_id_uidx
  on public.student_purchases(provider, provider_payment_id)
  where provider_payment_id is not null;

-- A student can only read their own purchase rows; only the Edge Functions
-- using the service-role key can create or activate purchase records.
revoke insert, update, delete on public.student_purchases from anon, authenticated;
