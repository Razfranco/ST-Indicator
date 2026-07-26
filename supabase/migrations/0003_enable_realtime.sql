-- ============================================================================
-- יומן מסחר יומי — הפעלת Realtime על טבלת trades
-- כדי שעדכון עסקה ממכשיר אחד (למשל הנייד) יופיע מיידית בכל מכשיר אחר
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trades'
  ) then
    alter publication supabase_realtime add table public.trades;
  end if;
end $$;
