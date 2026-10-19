-- ============================================================================
-- ST Indicator — הוצאות קבועות (חוזרות) לצד ההוצאות המשתנות הקיימות
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001–0011)
--
-- הוצאה קבועה היא כלל חוזר (סכום + תדירות + תאריך התחלה), לא שורה לכל חודש —
-- החישוב כמה פעמים היא חלה בטווח נתון נעשה בצד הקליינט (src/lib/businessStats.ts),
-- באותו עיקרון שלפיו ימים-לסיום-מנוי ויתרת הקופה מחושבים ולא נשמרים.
-- ============================================================================

create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  expense_name text not null,
  amount numeric not null,
  recurrence text not null check (recurrence in ('weekly', 'monthly', 'yearly')),
  start_date date not null,
  note text
);

alter table public.fixed_expenses enable row level security;

drop policy if exists "fixed_expenses_business_admin_only" on public.fixed_expenses;
create policy "fixed_expenses_business_admin_only"
  on public.fixed_expenses for all
  using (public.is_business_admin())
  with check (public.is_business_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fixed_expenses'
  ) then
    alter publication supabase_realtime add table public.fixed_expenses;
  end if;
end $$;
