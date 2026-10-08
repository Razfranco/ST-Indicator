-- ============================================================================
-- ST Indicator — קופה: הפרשות תקופתיות מההכנסות לרזרבה
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001–0010)
-- ============================================================================

create table if not exists public.treasury_transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  transaction_date date not null,
  type text not null check (type in ('deposit', 'withdrawal')),
  amount numeric not null check (amount > 0),
  note text
);

create index if not exists treasury_transactions_date_idx on public.treasury_transactions (transaction_date);

alter table public.treasury_transactions enable row level security;

drop policy if exists "treasury_transactions_business_admin_only" on public.treasury_transactions;
create policy "treasury_transactions_business_admin_only"
  on public.treasury_transactions for all
  using (public.is_business_admin())
  with check (public.is_business_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'treasury_transactions'
  ) then
    alter publication supabase_realtime add table public.treasury_transactions;
  end if;
end $$;
