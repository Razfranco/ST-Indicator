-- ============================================================================
-- ST Indicator — הקפאת מנוי: שמירת ימים שנותרו בזמן הקפאה, לחידוש מדויק בשחרור
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0016)
-- ============================================================================

-- כמה ימים נותרו למנוי בדיוק ברגע ההקפאה (status הופך ל-'paused'). null = לא מוקפא
-- כרגע, או מושהה ידנית מלפני התכונה הזו (בלי נתון ימים שמור).
alter table public.customers
  add column if not exists frozen_remaining_days integer;

-- מתי בוצעה ההקפאה — לתצוגה בלבד.
alter table public.customers
  add column if not exists frozen_at date;
