-- ============================================================================
-- ST Indicator — תאריך ושעה לפולו-אפ בלידים
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001–0008)
-- ============================================================================

alter table public.leads
  add column if not exists follow_up_at timestamptz;
