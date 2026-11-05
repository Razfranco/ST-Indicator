-- Durable per-run work, private recording capability and separately scoped worker key.
begin;
alter table public.meeting_ai_runs add column queued_at timestamptz;
alter table public.meeting_ai_runs add column queue_state text check(queue_state in ('waiting','running','completed','failed'));
create table public.mentoring_ai_worker_key(id boolean primary key default true check(id),key_hash text not null);
create table public.mentoring_ai_jobs(
 run_id uuid primary key references public.meeting_ai_runs(id) on delete cascade,
 state text not null default 'waiting' check(state in ('waiting','running','completed','failed')),
 recording_url text,available_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '23 hours',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create function public.sync_mentoring_ai_queue_state() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update meeting_ai_runs set queue_state=new.state,status=case when new.state='failed' and status<>'completed' then 'failed' else status end,error_code=case when new.state='failed' then coalesce(error_code,'processing_failed') else error_code end,updated_at=now() where id=new.run_id;
 return new;
end $$;
revoke all on function public.sync_mentoring_ai_queue_state() from public,anon,authenticated;
create trigger mentoring_ai_queue_state after insert or update of state on public.mentoring_ai_jobs for each row execute function public.sync_mentoring_ai_queue_state();
alter table public.mentoring_ai_worker_key enable row level security;
alter table public.mentoring_ai_jobs enable row level security;
revoke all on public.mentoring_ai_worker_key,public.mentoring_ai_jobs from anon,authenticated;
create function public.mentoring_ai_worker_authorized(p_key text) returns boolean language sql stable security definer set search_path=public as $$
 select length(p_key)=64 and exists(select 1 from mentoring_ai_worker_key where key_hash=encode(sha256(convert_to(p_key,'UTF8')),'hex'))
$$;
revoke all on function public.mentoring_ai_worker_authorized(text) from public,anon,authenticated;
create function public.mentoring_ai_creator_allowed(p_run uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from meeting_ai_runs r join mentorship_meetings m on m.id=r.meeting_id join profiles p on p.id=r.created_by
 where r.id=p_run and m.consent_given and p.approved and (p.role='admin' or (p.mentor_access and m.mentor_user_id=p.id)))
$$;
revoke all on function public.mentoring_ai_creator_allowed(uuid) from public,anon,authenticated;
create function public.mentoring_ai_queue_ready() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and approved and (role='admin' or mentor_access)) and exists(select 1 from mentoring_ai_worker_key)
$$;
revoke all on function public.mentoring_ai_queue_ready() from public,anon;
grant execute on function public.mentoring_ai_queue_ready() to authenticated;
create function public.enqueue_mentoring_ai_job(p_id uuid,p_recording_url text default null) returns setof public.meeting_ai_runs language plpgsql security definer set search_path=public as $$
declare r meeting_ai_runs;
begin
 select * into r from meeting_ai_runs where id=p_id for update;
 if not found or not can_access_mentoring_meeting(r.meeting_id) then raise exception 'not_found';end if;
 if not mentoring_ai_queue_ready() then raise exception 'schema_missing';end if;
 if not exists(select 1 from mentorship_meetings where id=r.meeting_id and consent_given) then raise exception 'consent_required';end if;
 if r.status='completed' then return next r;return;end if;
 if nullif(trim(r.transcript_text),'') is null then
 if not exists(select 1 from storage.objects where bucket_id='mentoring-recordings' and name=r.recording_path) then raise exception 'audio_invalid';end if;
 if p_recording_url is null or length(p_recording_url)>10000 or p_recording_url not like 'https://bkbwiiisrnbfdqkepemc.supabase.co/storage/v1/object/sign/mentoring-recordings/'||r.recording_path||'?token=%' then raise exception 'audio_invalid';end if;
 end if;
 if (nullif(trim(r.transcript_text),'') is null and r.transcription_attempts>=3) or (nullif(trim(r.transcript_text),'') is not null and r.summary_attempts>=3) then raise exception 'daily_limit';end if;
 insert into mentoring_ai_jobs(run_id,recording_url) values(p_id,p_recording_url)
 on conflict(run_id) do update set recording_url=coalesce(excluded.recording_url,mentoring_ai_jobs.recording_url),
 state=case when mentoring_ai_jobs.state='running' and r.locked_until>now() then 'running' else 'waiting' end,
 available_at=now(),expires_at=now()+interval '23 hours',updated_at=now();
 return query update meeting_ai_runs set queued_at=now(),error_code=null,updated_at=now() where id=p_id returning *;
end $$;
revoke all on function public.enqueue_mentoring_ai_job(uuid,text) from public,anon;
grant execute on function public.enqueue_mentoring_ai_job(uuid,text) to authenticated;
create function public.claim_mentoring_ai_job(p_key text,p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare picked uuid; r meeting_ai_runs; link text;
begin
 if not mentoring_ai_worker_authorized(p_key) then raise exception 'unauthorized';end if;
 update mentoring_ai_jobs j set state='failed',recording_url=null,updated_at=now()
 where state in ('waiting','running') and (expires_at<now() or not mentoring_ai_creator_allowed(j.run_id));
 update mentoring_ai_jobs j set state='failed',recording_url=null,updated_at=now() from meeting_ai_runs r
 where j.run_id=r.id and j.state in ('waiting','running') and (r.locked_until is null or r.locked_until<now())
 and ((nullif(trim(r.transcript_text),'') is null and r.transcription_attempts>=3) or (nullif(trim(r.transcript_text),'') is not null and r.summary_attempts>=3));
 select j.run_id into picked from mentoring_ai_jobs j join meeting_ai_runs m on m.id=j.run_id
 where j.state in ('waiting','running') and j.available_at<=now() and j.expires_at>now() and m.status<>'completed'
 and (m.locked_until is null or m.locked_until<now()) and mentoring_ai_creator_allowed(m.id)
 order by j.available_at,j.created_at for update of j,m skip locked limit 1;
 if picked is null then return null;end if;
 update mentoring_ai_jobs set state='running',updated_at=now() where run_id=picked returning recording_url into link;
 update meeting_ai_runs set status=case when nullif(trim(transcript_text),'') is null then 'transcribing' else 'summarizing' end,
 lease_token=p_token,locked_until=now()+interval '6 minutes',error_code=null,updated_at=now(),
 transcription_attempts=transcription_attempts+case when nullif(trim(transcript_text),'') is null then 1 else 0 end,
 summary_attempts=summary_attempts+case when nullif(trim(transcript_text),'') is not null then 1 else 0 end
 where id=picked returning * into r;
 return jsonb_build_object('run',to_jsonb(r),'recordingUrl',link);
end $$;
create function public.finish_mentoring_ai_job(p_key text,p_id uuid,p_token uuid,p_transcript text default null,p_summary jsonb default null,p_usage jsonb default null,p_error text default null) returns boolean language plpgsql security definer set search_path=public as $$
declare r meeting_ai_runs; m mentorship_meetings; retry boolean;
begin
 if not mentoring_ai_worker_authorized(p_key) then raise exception 'unauthorized';end if;
 select * into r from meeting_ai_runs where id=p_id and lease_token=p_token and locked_until>now() for update;
 if not found then return false;end if;
 if not mentoring_ai_creator_allowed(p_id) then
 update mentoring_ai_jobs set state='failed',recording_url=null,updated_at=now() where run_id=p_id;
 update meeting_ai_runs set lease_token=null,locked_until=null,status='failed',error_code='processing_failed',updated_at=now() where id=p_id;
 return false;end if;
 if p_error is not null and p_error not in ('ai_limit','ai_key','ai_unavailable','audio_size','audio_invalid','transcript_invalid','summary_incomplete','summary_refused','summary_invalid','processing_failed') then raise exception 'invalid_error';end if;
 if (p_error is null and p_transcript is null and p_summary is null) or (p_transcript is not null and p_summary is not null) then raise exception 'invalid_result';end if;
 if p_transcript is not null and (r.status<>'transcribing' or length(trim(p_transcript))<1 or length(p_transcript)>180000) then raise exception 'transcript_invalid';end if;
 if p_summary is not null and (r.status<>'summarizing' or jsonb_typeof(p_summary)<>'object' or length(p_summary::text)>100000) then raise exception 'summary_invalid';end if;
 update meeting_ai_runs set transcript_text=coalesce(p_transcript,transcript_text),summary=coalesce(p_summary,summary),usage=coalesce(p_usage,usage),
 status=case when p_error is not null then 'failed' when p_summary is not null then 'completed' else 'transcribed' end,
 error_code=p_error,lease_token=null,locked_until=null,updated_at=now() where id=p_id;
 retry:=p_error in ('ai_limit','ai_unavailable','summary_incomplete','processing_failed') and case when r.status='transcribing' then r.transcription_attempts<3 else r.summary_attempts<3 end;
 update mentoring_ai_jobs set state=case when p_summary is not null then 'completed' when p_error is null or retry then 'waiting' else 'failed' end,
 recording_url=case when p_transcript is not null or p_summary is not null or (p_error is not null and not retry) then null else recording_url end,
 available_at=now()+case when p_error is not null then interval '2 minutes' else interval '0 seconds' end,updated_at=now() where run_id=p_id;
 if p_summary is not null then
 select * into m from mentorship_meetings where id=r.meeting_id;
 insert into platform_notification_events(event_key,module,kind,entity_id,mentor_id,starts_at,subject,body,path)
 values('mentoring-summary-ready:'||p_id,'mentoring','summary_ready',p_id,m.mentor_user_id,m.starts_at,'סיכום פגישת ליווי מוכן לבדיקה',coalesce((select display_name from students where id=m.student_id),'תלמיד')||' · התמלול וטיוטת הסיכום הושלמו. יש לבדוק ולאשר את הטיוטה לפני שימוש.','/mentoring/meetings/'||r.meeting_id||'/edit')
 on conflict(event_key) do nothing;
 end if;
 return true;
end $$;
revoke all on function public.claim_mentoring_ai_job(text,uuid),public.finish_mentoring_ai_job(text,uuid,uuid,text,jsonb,jsonb,text) from public,authenticated;
grant execute on function public.claim_mentoring_ai_job(text,uuid),public.finish_mentoring_ai_job(text,uuid,uuid,text,jsonb,jsonb,text) to anon;
commit;
