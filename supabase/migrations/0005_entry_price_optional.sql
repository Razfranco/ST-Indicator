-- ============================================================================
-- ST Indicator — הפיכת מחיר כניסה לשדה רשות
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

alter table public.trades
  alter column entry_price drop not null;
