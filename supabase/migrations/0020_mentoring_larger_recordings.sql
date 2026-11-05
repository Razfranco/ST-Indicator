-- Larger immutable originals; provider-bound audio is compressed server-side.
begin;
alter table public.meeting_ai_runs drop constraint meeting_ai_runs_audio_bytes_check;
alter table public.meeting_ai_runs add constraint meeting_ai_runs_audio_bytes_check check(audio_bytes between 1 and 50000000);
create or replace function public.create_mentoring_ai_run(p_id uuid,p_meeting uuid,p_filename text default null,p_bytes integer default null,p_from_transcript boolean default false)
returns public.meeting_ai_runs language plpgsql security definer set search_path=public as $$
declare s mentoring_ai_settings; r meeting_ai_runs; txt text; ext text;
begin
 if not public.can_access_mentoring_meeting(p_meeting) then raise exception 'not_found'; end if;
 if not exists(select 1 from mentorship_meetings where id=p_meeting and consent_given) then raise exception 'consent_required'; end if;
 select * into r from meeting_ai_runs where id=p_id;
 if found then
   if r.meeting_id<>p_meeting then raise exception 'not_found'; end if;
   return r;
 end if;
 if (select count(*) from meeting_ai_runs where created_by=auth.uid() and created_at>now()-interval '24 hours')>=20 then raise exception 'daily_limit'; end if;
 select * into strict s from mentoring_ai_settings where id='default';
 if p_from_transcript then
   select transcript_text into txt from meeting_transcripts where meeting_id=p_meeting;
   if txt is null or length(trim(txt))<1 or length(txt)>180000 then raise exception 'transcript_invalid'; end if;
 else
   ext:=lower(substring(p_filename from '\.([^.]+)$'));
   if ext is null or ext not in ('mp3','mp4','mpeg','mpga','m4a','wav','webm') or length(p_filename)>240 or p_bytes is null or p_bytes<1 or p_bytes>50000000 then raise exception 'audio_invalid'; end if;
 end if;
 insert into meeting_ai_runs(id,meeting_id,created_by,filename,audio_bytes,recording_path,status,transcript_text,instructions_snapshot,examples_snapshot,settings_version,style_ready)
 values(p_id,p_meeting,auth.uid(),case when p_from_transcript then null else p_filename end,case when p_from_transcript then null else p_bytes end,
 case when p_from_transcript then null else p_meeting::text||'/'||p_id::text||'/recording.'||ext end,
 case when p_from_transcript then 'transcribed' else 'uploaded' end,txt,s.instructions,s.examples,s.updated_at,s.style_ready) returning * into r;
 return r;
end $$;

update storage.buckets set file_size_limit=50000000 where id='mentoring-recordings';
commit;
