-- ============================================================================
-- ST Indicator — מודול ניהול עסקי (CRM): לקוחות, חיובים, לידים, הוצאות
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001–0005)
--
-- המודול הזה נפרד לחלוטין מיומן העסקאות (trades) ומזרימת האישור של השותפים
-- (profiles.approved / is_admin). הגישה אליו נשלטת על ידי עמודה ייעודית
-- (profiles.business_access) ופונקציית is_business_admin() נפרדת — שותף
-- שאושר לראות עסקאות לא מקבל גישה למודול העסקי אוטומטית.
-- ============================================================================

-- הרשאת גישה למודול העסקי — נפרדת לחלוטין מ-approved/role
alter table public.profiles
  add column if not exists business_access boolean not null default false;

-- הענקת גישה עסקית לבעל החשבון (המנהל) הקיים בפועל
update public.profiles
  set business_access = true
  where role = 'admin';

create or replace function public.is_business_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (select business_access from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- customers — משתמשים משלמים פעילים
-- ----------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  full_name text not null,
  email text,
  tv_username text not null,
  discord_username text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  phone text not null,
  plan text not null,
  period text not null,
  subscription_start_date date not null,
  subscription_end_date date not null,
  follow_up_notes text,
  mentor text not null,
  access text not null,
  password text
);

alter table public.customers enable row level security;

drop policy if exists "customers_business_admin_only" on public.customers;
create policy "customers_business_admin_only"
  on public.customers for all
  using (public.is_business_admin())
  with check (public.is_business_admin());

-- ----------------------------------------------------------------------------
-- customer_billings — היסטוריית חיובים לכל לקוח (many-to-one)
-- ----------------------------------------------------------------------------
create table if not exists public.customer_billings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  customer_id uuid not null references public.customers (id) on delete cascade,
  amount numeric not null,
  billing_month date not null,
  billing_note text,
  is_recurring_monthly boolean not null default false,
  plan_cost numeric not null
);

create index if not exists customer_billings_customer_id_idx on public.customer_billings (customer_id);
create index if not exists customer_billings_billing_month_idx on public.customer_billings (billing_month);

alter table public.customer_billings enable row level security;

drop policy if exists "customer_billings_business_admin_only" on public.customer_billings;
create policy "customer_billings_business_admin_only"
  on public.customer_billings for all
  using (public.is_business_admin())
  with check (public.is_business_admin());

-- ----------------------------------------------------------------------------
-- leads — משתמשים מתעניינים (ללא קשר לטבלת customers)
-- ----------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  full_name text not null,
  phone text not null,
  source text not null,
  note text,
  follow_up text
);

alter table public.leads enable row level security;

drop policy if exists "leads_business_admin_only" on public.leads;
create policy "leads_business_admin_only"
  on public.leads for all
  using (public.is_business_admin())
  with check (public.is_business_admin());

-- ----------------------------------------------------------------------------
-- additional_expenses — הוצאות נוספות, משויכות לחודש (לצורך תזרים)
-- ----------------------------------------------------------------------------
create table if not exists public.additional_expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  expense_name text not null,
  amount numeric not null,
  note text not null,
  expense_month date not null
);

create index if not exists additional_expenses_expense_month_idx on public.additional_expenses (expense_month);

alter table public.additional_expenses enable row level security;

drop policy if exists "additional_expenses_business_admin_only" on public.additional_expenses;
create policy "additional_expenses_business_admin_only"
  on public.additional_expenses for all
  using (public.is_business_admin())
  with check (public.is_business_admin());

-- ----------------------------------------------------------------------------
-- Realtime — סנכרון חי בין מכשירים, כמו trades/profiles
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customers'
  ) then
    alter publication supabase_realtime add table public.customers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customer_billings'
  ) then
    alter publication supabase_realtime add table public.customer_billings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'additional_expenses'
  ) then
    alter publication supabase_realtime add table public.additional_expenses;
  end if;
end $$;
