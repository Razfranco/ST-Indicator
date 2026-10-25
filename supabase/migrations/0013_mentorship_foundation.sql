-- ============================================================================
-- ST Indicator — מודול מנטורינג, שלב 1 (Foundation): תלמידים, שיוכי מנטור, פגישות
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001–0012)
--
-- זהו שלב הבסיס בלבד (לפי שלבי המימוש ב-README של המודול): RBAC, תלמידים,
-- שיוכי מנטור-תלמיד, ויומן פגישות. תמלולים וסיכומי AI הם שלבים נפרדים בהמשך,
-- ודורשים תשתית נוספת (Vercel Function — אסור לחשוף מפתח OpenAI בדפדפן).
-- ============================================================================

-- הרשאת גישה למודול המנטורינג — נפרדת לחלוטין מ-approved/business_access
alter table public.profiles
  add column if not exists mentor_access boolean not null default false;

create or replace function public.is_mentor()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (select mentor_access from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- יצירת כל הטבלאות קודם (כדי ש-RLS על students יוכל להפנות ל-mentor_assignments)
-- ----------------------------------------------------------------------------

-- students — תלמידי ליווי (קבוצה נפרדת לחלוטין מ-customers)
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  display_name text not null,
  phone text,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  notes text
);

-- mentor_assignments — מקור האמת למי-מלווה-את-מי (עם היסטוריה, לא נמחק)
create table if not exists public.mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  student_id uuid not null references public.students (id) on delete cascade,
  mentor_user_id uuid not null references auth.users (id) on delete cascade,
  active boolean not null default true,
  valid_from date not null default current_date,
  valid_to date
);

create index if not exists mentor_assignments_student_id_idx on public.mentor_assignments (student_id);
create index if not exists mentor_assignments_mentor_user_id_idx on public.mentor_assignments (mentor_user_id);

-- mentorship_meetings — יומן פגישות ליווי
create table if not exists public.mentorship_meetings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  student_id uuid not null references public.students (id) on delete cascade,
  mentor_user_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null default 60,
  channel text not null check (channel in ('whatsapp', 'google_meet', 'other')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  topic text,
  notes text,
  consent_given boolean not null default false
);

create index if not exists mentorship_meetings_student_id_idx on public.mentorship_meetings (student_id);
create index if not exists mentorship_meetings_mentor_user_id_idx on public.mentorship_meetings (mentor_user_id);
create index if not exists mentorship_meetings_starts_at_idx on public.mentorship_meetings (starts_at);

-- ----------------------------------------------------------------------------
-- RLS — עכשיו ששלוש הטבלאות קיימות, אפשר להפנות ביניהן בבטחה
-- ----------------------------------------------------------------------------

alter table public.students enable row level security;

drop policy if exists "students_admin_all" on public.students;
create policy "students_admin_all"
  on public.students for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "students_mentor_assigned_only" on public.students;
create policy "students_mentor_assigned_only"
  on public.students for select
  using (
    public.is_mentor()
    and exists (
      select 1 from public.mentor_assignments ma
      where ma.student_id = students.id and ma.mentor_user_id = auth.uid()
    )
  );

alter table public.mentor_assignments enable row level security;

drop policy if exists "mentor_assignments_admin_all" on public.mentor_assignments;
create policy "mentor_assignments_admin_all"
  on public.mentor_assignments for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mentor_assignments_mentor_own_select" on public.mentor_assignments;
create policy "mentor_assignments_mentor_own_select"
  on public.mentor_assignments for select
  using (public.is_mentor() and mentor_user_id = auth.uid());

alter table public.mentorship_meetings enable row level security;

drop policy if exists "mentorship_meetings_admin_all" on public.mentorship_meetings;
create policy "mentorship_meetings_admin_all"
  on public.mentorship_meetings for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mentorship_meetings_mentor_own" on public.mentorship_meetings;
create policy "mentorship_meetings_mentor_own"
  on public.mentorship_meetings for all
  using (public.is_mentor() and mentor_user_id = auth.uid())
  with check (public.is_mentor() and mentor_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'students'
  ) then
    alter publication supabase_realtime add table public.students;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mentor_assignments'
  ) then
    alter publication supabase_realtime add table public.mentor_assignments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mentorship_meetings'
  ) then
    alter publication supabase_realtime add table public.mentorship_meetings;
  end if;
end $$;
