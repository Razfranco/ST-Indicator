-- Private meeting recordings and versioned AI drafts. Apply to the STIndicatorData project.
begin;
create or replace function public.can_access_mentoring_meeting(p_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from mentorship_meetings m join profiles p on p.id=auth.uid()
 where m.id=p_id and p.approved and (p.role='admin' or (p.mentor_access and m.mentor_user_id=auth.uid())));
$$;
revoke all on function public.can_access_mentoring_meeting(uuid) from public,anon;
grant execute on function public.can_access_mentoring_meeting(uuid) to authenticated;
create table public.mentoring_ai_settings (
 id text primary key check(id='default'),
 instructions text not null check(length(instructions) between 1 and 20000),
 examples text not null default '' check(length(examples)<=60000),
 style_ready boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
insert into public.mentoring_ai_settings(id,instructions) values('default','כתוב סיכום פגישת מנטורינג בעברית, ברור ומדויק, עם כותרות ופסקאות קצרות. כלול מטרת הפגישה, נושאים שנדונו, הסברים מרכזיים, החלטות, משימות ושאלות פתוחות כאשר הם קיימים בתמליל. שמור מונחי מסחר באנגלית כשמועיל. אל תמציא פרטים, מועדים, ציטוטים או המלצות שלא נאמרו. ציין מידע חסר. זהו סגנון ראשוני, עד להוספת הנחיות ודוגמאות אישיות.');
alter table public.mentoring_ai_settings enable row level security;
create policy ai_settings_read on public.mentoring_ai_settings for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.approved and (p.role='admin' or p.mentor_access)));
create policy ai_settings_edit on public.mentoring_ai_settings for update to authenticated using(public.is_admin()) with check(public.is_admin() and updated_by=auth.uid());
revoke all on public.mentoring_ai_settings from anon,authenticated;
grant select,update on public.mentoring_ai_settings to authenticated;
create table public.meeting_ai_runs (
 id uuid primary key,
 meeting_id uuid not null references public.mentorship_meetings(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 filename text,
 recording_path text,
 audio_bytes integer check(audio_bytes between 1 and 25000000),
 status text not null default 'uploaded' check(status in ('uploaded','transcribing','transcribed','summarizing','completed','failed')),
 transcript_text text check(length(transcript_text)<=180000),
 summary jsonb,
 reviewed_text text check(length(reviewed_text)<=60000),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 instructions_snapshot text not null,
 examples_snapshot text not null,
 settings_version timestamptz not null,
 style_ready boolean not null,
 transcription_model text not null default 'gpt-transcribe',
 summary_model text not null default 'gpt-6.1-sol',
 transcription_attempts integer not null default 0,
 summary_attempts integer not null default 0,
 lease_token uuid,
 locked_until timestamptz,
 error_code text,
 usage jsonb
);
create index meeting_ai_runs_meeting on public.meeting_ai_runs(meeting_id,created_at desc);
alter table public.meeting_ai_runs enable row level security;
create policy meeting_ai_runs_read on public.meeting_ai_runs for select to authenticated using(public.can_access_mentoring_meeting(meeting_id));
revoke all on public.meeting_ai_runs from anon,authenticated;
grant select on public.meeting_ai_runs to authenticated;

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
   if ext is null or ext not in ('mp3','mp4','mpeg','mpga','m4a','wav','webm') or length(p_filename)>240 or p_bytes is null or p_bytes<1 or p_bytes>25000000 then raise exception 'audio_invalid'; end if;
 end if;
 insert into meeting_ai_runs(id,meeting_id,created_by,filename,audio_bytes,recording_path,status,transcript_text,instructions_snapshot,examples_snapshot,settings_version,style_ready)
 values(p_id,p_meeting,auth.uid(),case when p_from_transcript then null else p_filename end,case when p_from_transcript then null else p_bytes end,
 case when p_from_transcript then null else p_meeting::text||'/'||p_id::text||'/recording.'||ext end,
 case when p_from_transcript then 'transcribed' else 'uploaded' end,txt,s.instructions,s.examples,s.updated_at,s.style_ready) returning * into r;
 return r;
end $$;

create or replace function public.claim_mentoring_ai_run(p_id uuid,p_token uuid)
returns setof public.meeting_ai_runs language plpgsql security definer set search_path=public as $$
begin
 return query update meeting_ai_runs r set
   status=case when nullif(trim(r.transcript_text),'') is null then 'transcribing' else 'summarizing' end,
   lease_token=p_token,locked_until=now()+interval '5 minutes',updated_at=now(),error_code=null,
   transcription_attempts=r.transcription_attempts+case when nullif(trim(r.transcript_text),'') is null then 1 else 0 end,
   summary_attempts=r.summary_attempts+case when nullif(trim(r.transcript_text),'') is not null then 1 else 0 end
 where r.id=p_id and public.can_access_mentoring_meeting(r.meeting_id)
 and exists(select 1 from mentorship_meetings m where m.id=r.meeting_id and m.consent_given)
 and r.status<>'completed' and (r.locked_until is null or r.locked_until<now())
 and case when nullif(trim(r.transcript_text),'') is null then r.transcription_attempts<3 else r.summary_attempts<3 end
 returning r.*;
end $$;

create or replace function public.finish_mentoring_ai_run(p_id uuid,p_token uuid,p_transcript text default null,p_summary jsonb default null,p_usage jsonb default null,p_error text default null)
returns setof public.meeting_ai_runs language plpgsql security definer set search_path=public as $$
begin
 if p_error is not null and p_error not in ('ai_limit','ai_key','ai_unavailable','audio_size','audio_invalid','transcript_invalid','summary_incomplete','summary_refused','summary_invalid','processing_failed') then raise exception 'invalid_error'; end if;
 if p_transcript is not null and (length(trim(p_transcript))<1 or length(p_transcript)>180000) then raise exception 'transcript_invalid'; end if;
 if p_summary is not null and (jsonb_typeof(p_summary)<>'object' or length(p_summary::text)>100000) then raise exception 'summary_invalid'; end if;
 return query update meeting_ai_runs r set
 transcript_text=coalesce(p_transcript,r.transcript_text),summary=coalesce(p_summary,r.summary),usage=coalesce(p_usage,r.usage),
 status=case when p_error is not null then 'failed' when p_summary is not null then 'completed' else 'transcribed' end,
 error_code=p_error,lease_token=null,locked_until=null,updated_at=now()
 where r.id=p_id and r.lease_token=p_token and public.can_access_mentoring_meeting(r.meeting_id) returning r.*;
end $$;

create or replace function public.review_mentoring_ai_run(p_id uuid,p_text text)
returns setof public.meeting_ai_runs language plpgsql security definer set search_path=public as $$
begin
 if length(trim(p_text))<1 or length(p_text)>60000 then raise exception 'invalid_review'; end if;
 return query update meeting_ai_runs r set reviewed_text=p_text,reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
 where r.id=p_id and r.status='completed' and public.can_access_mentoring_meeting(r.meeting_id) returning r.*;
end $$;

revoke all on function public.create_mentoring_ai_run(uuid,uuid,text,integer,boolean),public.claim_mentoring_ai_run(uuid,uuid),public.finish_mentoring_ai_run(uuid,uuid,text,jsonb,jsonb,text),public.review_mentoring_ai_run(uuid,text) from public,anon;
grant execute on function public.create_mentoring_ai_run(uuid,uuid,text,integer,boolean),public.claim_mentoring_ai_run(uuid,uuid),public.finish_mentoring_ai_run(uuid,uuid,text,jsonb,jsonb,text),public.review_mentoring_ai_run(uuid,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit) values('mentoring-recordings','mentoring-recordings',false,25000000);
create policy mentoring_audio_read on storage.objects for select to authenticated using(bucket_id='mentoring-recordings' and exists(select 1 from public.meeting_ai_runs r where r.recording_path=name and public.can_access_mentoring_meeting(r.meeting_id)));
create policy mentoring_audio_insert on storage.objects for insert to authenticated with check(bucket_id='mentoring-recordings' and exists(select 1 from public.meeting_ai_runs r where r.recording_path=name and r.created_by=auth.uid() and r.status='uploaded' and public.can_access_mentoring_meeting(r.meeting_id)));
-- No public files, overwrite or delete policy. A new run preserves previous versions.
commit;
