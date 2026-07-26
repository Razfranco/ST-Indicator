-- ============================================================================
-- ST Indicator — משתמשים מרובים + אישור מנהל (יומן משותף)
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001, 0002, 0003)
-- ============================================================================

-- טבלת פרופילים: תפקיד (admin/member) וסטטוס אישור לכל משתמש
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- יצירת פרופיל אוטומטית לכל משתמש חדש שנרשם (ברירת מחדל: member, לא מאושר)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, approved)
  values (new.id, new.email, 'member', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- גיבוי לאחור: משתמשים קיימים שעדיין אין להם פרופיל (כלומר החשבון היחיד
-- שכבר קיים כרגע) הופכים אוטומטית למנהל מאושר. לא פוגע במשתמשים חדשים
-- שכבר קיבלו פרופיל דרך הטריגר לעיל.
insert into public.profiles (id, email, role, approved)
select id, email, 'admin', true
from auth.users
on conflict (id) do nothing;

-- פונקציות עזר ל-RLS (security definer, כדי לעקוף רקורסיה על profiles עצמה)
create or replace function public.is_approved()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select approved from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (select role = 'admin' and approved from public.profiles where id = auth.uid()),
    false
  );
$$;

-- מדיניות RLS על profiles: כל משתמש רואה את עצמו, מנהל רואה ומעדכן את כולם
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_update_admin_only"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- מדיניות RLS חדשה על trades: יומן משותף — כל משתמש מאושר רואה/מוסיף/עורך/מוחק הכל
drop policy if exists "trades_select_own" on public.trades;
drop policy if exists "trades_insert_own" on public.trades;
drop policy if exists "trades_update_own" on public.trades;
drop policy if exists "trades_delete_own" on public.trades;

drop policy if exists "trades_select_approved" on public.trades;
create policy "trades_select_approved"
  on public.trades for select
  using (public.is_approved());

drop policy if exists "trades_insert_approved" on public.trades;
create policy "trades_insert_approved"
  on public.trades for insert
  with check (public.is_approved());

drop policy if exists "trades_update_approved" on public.trades;
create policy "trades_update_approved"
  on public.trades for update
  using (public.is_approved())
  with check (public.is_approved());

drop policy if exists "trades_delete_approved" on public.trades;
create policy "trades_delete_approved"
  on public.trades for delete
  using (public.is_approved());

-- הוספת profiles ל-Realtime, כדי שמסך הניהול והמסך "ממתין לאישור" יתעדכנו מיידית
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
