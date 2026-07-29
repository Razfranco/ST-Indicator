-- ============================================================================
-- ST Indicator — סטטוס "שבוע ניסיון" ותוקף שבוע הניסיון עבור לידים
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001–0007)
-- ============================================================================

-- עדכון ה-constraint על leads.status כך שיכלול גם 'trial_week'
do $$
declare
  con_name text;
begin
  select con.conname into con_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
  where rel.relname = 'leads'
    and con.contype = 'c'
    and att.attname = 'status';

  if con_name is not null then
    execute format('alter table public.leads drop constraint %I', con_name);
  end if;
end $$;

alter table public.leads
  add constraint leads_status_check check (status in ('relevant', 'not_relevant', 'trial_week'));

-- תוקף שבוע הניסיון (רלוונטי רק כאשר status = 'trial_week')
alter table public.leads
  add column if not exists trial_week_expiry date;
