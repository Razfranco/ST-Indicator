-- ============================================================================
-- ST Indicator — דגלי מעקב לחלונית ההתראות: גישה שהוסרה (לקוחות), טופל (לידים)
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0015)
-- ============================================================================

-- מתי סומן בפועל "גישה הוסרה" ללקוח שמנויו פג. null = עדיין לא טופל.
-- מתאפס אוטומטית ל-null כשהמנוי מוארך (ב-CustomerFormPage), כדי שהתראה
-- תוכל לחזור אם המנוי יפוג שוב בעתיד.
alter table public.customers
  add column if not exists access_removed_at timestamptz;

-- האם הטיפול בליד (שאין לו פולו-אפ עתידי, או שהתוקף שלו עבר) סומן כהושלם.
alter table public.leads
  add column if not exists handled boolean not null default false;
