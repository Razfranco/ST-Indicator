-- ============================================================================
-- ST Indicator — סטטוס רלוונטיות לליד (רלוונטי / לא רלוונטי)
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001–0006)
-- ============================================================================

alter table public.leads
  add column if not exists status text not null default 'relevant' check (status in ('relevant', 'not_relevant'));
