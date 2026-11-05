begin;
create or replace function public.claim_mentoring_ai_job(p_key text,p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare picked uuid; r meeting_ai_runs; link text;
begin
 if not mentoring_ai_worker_authorized(p_key) then raise exception 'unauthorized';end if;
 update mentoring_ai_jobs j set state='failed',recording_url=null,updated_at=now()
 where state in ('waiting','running') and (expires_at<now() or not mentoring_ai_creator_allowed(j.run_id));
 update mentoring_ai_jobs j set state='failed',recording_url=null,updated_at=now() from meeting_ai_runs prior
 where j.run_id=prior.id and j.state in ('waiting','running') and (prior.locked_until is null or prior.locked_until<now())
 and ((nullif(trim(prior.transcript_text),'') is null and prior.transcription_attempts>=3) or (nullif(trim(prior.transcript_text),'') is not null and prior.summary_attempts>=3));
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
commit;
