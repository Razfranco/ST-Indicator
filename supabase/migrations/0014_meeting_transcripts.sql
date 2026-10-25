-- ============================================================================
-- ST Indicator — תמלולי פגישות מנטורינג (עדיין בלי AI — רק צירוף/שמירה)
-- הרץ קובץ זה ב-Supabase Dashboard -> SQL Editor -> New query -> Run
-- (יש להריץ אחרי 0001–0013)
--
-- תמליל נשמר כטקסט ישירות בטבלה (לא קובץ ב-Storage) — ב-MVP הזה זה מספיק
-- ונמנע מצורך בבאקט פרטי/signed URLs לפני שיש בכלל שימוש אמיתי בתמליל (AI).
-- ============================================================================

create table if not exists public.meeting_transcripts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  meeting_id uuid not null references public.mentorship_meetings (id) on delete cascade,
  transcript_text text not null,
  filename text,
  uploaded_by uuid not null references auth.users (id),
  uploaded_at timestamptz not null default now(),

  unique (meeting_id)
);

alter table public.meeting_transcripts enable row level security;

drop policy if exists "meeting_transcripts_admin_all" on public.meeting_transcripts;
create policy "meeting_transcripts_admin_all"
  on public.meeting_transcripts for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "meeting_transcripts_mentor_own" on public.meeting_transcripts;
create policy "meeting_transcripts_mentor_own"
  on public.meeting_transcripts for all
  using (
    public.is_mentor()
    and exists (
      select 1 from public.mentorship_meetings m
      where m.id = meeting_transcripts.meeting_id and m.mentor_user_id = auth.uid()
    )
  )
  with check (
    public.is_mentor()
    and exists (
      select 1 from public.mentorship_meetings m
      where m.id = meeting_transcripts.meeting_id and m.mentor_user_id = auth.uid()
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meeting_transcripts'
  ) then
    alter publication supabase_realtime add table public.meeting_transcripts;
  end if;
end $$;
