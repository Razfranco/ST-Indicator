-- ============================================================================
-- יומן מסחר יומי — פישוט טופס ההזנה
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001_trades.sql)
--
-- הערה: אם כבר יש שורות עם result הישן (Win/Loss/Breakeven), יש למחוק/לעדכן
-- אותן לפני ההרצה, אחרת הוספת ה-constraint החדש תיכשל.
-- ============================================================================

-- הסרת שדות שאינם בשימוש עוד בטופס
alter table public.trades
  drop column if exists instrument,
  drop column if exists entry_timeframe,
  drop column if exists setup_type,
  drop column if exists session,
  drop column if exists discipline_score,
  drop column if exists stop_loss,
  drop column if exists take_profit,
  drop column if exists r_multiple,
  drop column if exists screenshot_url;

-- שדה חדש: כמות נקודות (לשימוש בחישוב האוטומטי של רווח/הפסד)
alter table public.trades
  add column if not exists points numeric;

-- עדכון הערכים האפשריים בשדה result: TP1 / TP2 / SL / BE (במקום Win/Loss/Breakeven)
do $$
declare
  con_name text;
begin
  select con.conname into con_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
  where rel.relname = 'trades'
    and con.contype = 'c'
    and att.attname = 'result';

  if con_name is not null then
    execute format('alter table public.trades drop constraint %I', con_name);
  end if;
end $$;

alter table public.trades
  add constraint trades_result_check check (result in ('TP1', 'TP2', 'SL', 'BE'));

-- הסרת מדיניות ה-storage הישנה (הבאקט עצמו נמחק ידנית דרך הדשבורד, לא ב-SQL)
drop policy if exists "trade_screenshots_select_own" on storage.objects;
drop policy if exists "trade_screenshots_insert_own" on storage.objects;
drop policy if exists "trade_screenshots_update_own" on storage.objects;
drop policy if exists "trade_screenshots_delete_own" on storage.objects;
