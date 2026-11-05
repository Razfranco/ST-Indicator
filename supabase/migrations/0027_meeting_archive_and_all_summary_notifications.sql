begin;
alter table public.mentorship_meetings add column archived_at timestamptz;
alter table public.mentorship_meetings add column archived_by uuid references public.profiles(id);
-- Old cached clients must not cascade-delete recordings, summaries and evidence.
revoke delete on public.mentorship_meetings from authenticated;
create function public.archive_mentoring_meetings(p_ids uuid[],p_archived boolean default true) returns integer
language plpgsql security definer set search_path=public as $$
declare total integer;
begin
 if p_archived is null or p_ids is null or cardinality(p_ids) not between 1 and 100 or array_position(p_ids,null) is not null then raise exception 'invalid';end if;
 if exists(select 1 from unnest(p_ids) requested(id) where not can_access_mentoring_meeting(requested.id)) then raise exception 'not_found';end if;
 update mentorship_meetings set archived_at=case when p_archived then coalesce(archived_at,now()) else null end,
 archived_by=case when p_archived then auth.uid() else null end where id=any(p_ids);
 get diagnostics total=row_count;
 if p_archived then
 update mentoring_ai_jobs j set state='failed',recording_url=null,updated_at=now() from meeting_ai_runs r where j.run_id=r.id and r.meeting_id=any(p_ids) and j.state in ('waiting','running');
 update meeting_ai_runs set lease_token=null,locked_until=null,status='failed',error_code='processing_failed',updated_at=now() where meeting_id=any(p_ids) and status in ('transcribing','summarizing');
 update platform_notification_events e set resolved=true where (e.module='mentoring' and e.entity_id=any(p_ids)) or
 (e.kind='summary_ready' and exists(select 1 from meeting_ai_runs r where r.id=e.entity_id and r.meeting_id=any(p_ids)));
 end if;
 return total;
end $$;
revoke all on function public.archive_mentoring_meetings(uuid[],boolean) from public,anon;
grant execute on function public.archive_mentoring_meetings(uuid[],boolean) to authenticated;
create function public.insert_mentoring_summary_event(p_run uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into platform_notification_events(event_key,module,kind,entity_id,mentor_id,starts_at,subject,body,path)
 select 'mentoring-summary-ready:'||r.id,'mentoring','summary_ready',r.id,m.mentor_user_id,m.starts_at,'סיכום פגישת ליווי מוכן לבדיקה',
 s.display_name||' · התמלול וטיוטת הסיכום הושלמו. יש לבדוק ולאשר את הטיוטה לפני שימוש.','/mentoring/meetings/'||m.id||'/edit'
 from meeting_ai_runs r join mentorship_meetings m on m.id=r.meeting_id join students s on s.id=m.student_id
 where r.id=p_run and r.status='completed' and m.archived_at is null on conflict(event_key) do nothing;
end $$;
revoke all on function public.insert_mentoring_summary_event(uuid) from public,anon,authenticated;
create function public.mentoring_summary_completed() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='completed' and old.status is distinct from 'completed' then perform insert_mentoring_summary_event(new.id);end if;
 return new;
end $$;
revoke all on function public.mentoring_summary_completed() from public,anon,authenticated;
create trigger mentoring_summary_completed after update of status on public.meeting_ai_runs for each row execute function public.mentoring_summary_completed();
create or replace function public.mentoring_ai_creator_allowed(p_run uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from meeting_ai_runs r join mentorship_meetings m on m.id=r.meeting_id join profiles p on p.id=r.created_by
 where r.id=p_run and m.archived_at is null and m.consent_given and p.approved and (p.role='admin' or (p.mentor_access and m.mentor_user_id=p.id)))
$$;
create or replace function public.mentoring_recording_missing(p_meeting uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from mentorship_meetings m where m.id=p_meeting and m.archived_at is null)
 and not exists(select 1 from meeting_ai_runs r join storage.objects o on o.bucket_id='mentoring-recordings' and o.name=r.recording_path where r.meeting_id=p_meeting)
$$;
-- Re-check current module access, assignment and archive state at delivery time.
create or replace function public.platform_notification_allowed(p_user uuid,p_event uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles p join platform_notification_events e on e.id=p_event where p.id=p_user and p.approved and not e.resolved
 and (e.actor_id is null or e.actor_id<>p.id)
 and ((e.module='business' and p.business_access) or (e.module='mentoring' and (p.role='admin' or (p.mentor_access and e.mentor_id=p.id))
 and not exists(select 1 from mentorship_meetings m where m.archived_at is not null and (m.id=e.entity_id or exists(select 1 from meeting_ai_runs r where r.id=e.entity_id and r.meeting_id=m.id))))))
$$;
create function public.prevent_archived_meeting_processing() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if (TG_OP='INSERT' or (new.status is distinct from old.status and new.status in ('transcribing','summarizing','completed'))) and exists(select 1 from mentorship_meetings where id=new.meeting_id and archived_at is not null) then raise exception 'meeting_archived';end if;
 return new;
end $$;
revoke all on function public.prevent_archived_meeting_processing() from public,anon,authenticated;
create trigger prevent_archived_meeting_processing before insert or update of status on public.meeting_ai_runs for each row execute function public.prevent_archived_meeting_processing();
commit;
