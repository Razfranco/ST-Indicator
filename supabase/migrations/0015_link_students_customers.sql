-- ============================================================================
-- ST Indicator — קישור ידני בין תלמיד (מנטורינג) ללקוח (CRM עסקי)
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001–0014)
--
-- הקישור הוא עמודה אופציונלית בלבד (nullable) ומנוהל ידנית ע"י אדמין
-- בטופס התלמיד — אין כאן שום ניסיון להתאים אוטומטית לפי שם/טלפון.
-- ============================================================================

alter table public.students
  add column if not exists customer_id uuid references public.customers (id) on delete set null;

create index if not exists students_customer_id_idx on public.students (customer_id);
