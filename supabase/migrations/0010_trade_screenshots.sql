-- ============================================================================
-- ST Indicator — צירוף צילום מסך (רשות) לעסקה
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001–0009)
--
-- הבאקט trade-screenshots נמחק ידנית ב-0002 כשהשדה screenshot_url הוסר.
-- כאן הוא נוצר מחדש, עם מדיניות משותפת (לא לפי תיקיית משתמש) כדי להתאים
-- ליומן המשותף שהונהג ב-0004 — כל משתמש מאושר יכול להעלות/למחוק כל תמונה.
-- ============================================================================

alter table public.trades
  add column if not exists screenshot_url text;

insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', true)
on conflict (id) do nothing;

drop policy if exists "trade_screenshots_all_approved" on storage.objects;
create policy "trade_screenshots_all_approved"
  on storage.objects for all
  using (bucket_id = 'trade-screenshots' and public.is_approved())
  with check (bucket_id = 'trade-screenshots' and public.is_approved());
