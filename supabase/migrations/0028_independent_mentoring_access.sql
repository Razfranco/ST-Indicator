-- approved is performance-dashboard access. Mentoring is independently granted by mentor_access.
-- Retain existing admin requirements, meeting ownership, consent, archive and worker boundaries.
begin;
create or replace function public.can_access_mentoring_meeting(p_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from mentorship_meetings m join profiles p on p.id=auth.uid()
 where m.id=p_id and ((p.approved and p.role='admin') or (p.mentor_access and m.mentor_user_id=p.id)));
$$;
alter policy ai_settings_read on public.mentoring_ai_settings using(
 exists(select 1 from public.profiles p where p.id=auth.uid() and ((p.approved and p.role='admin') or p.mentor_access))
);
alter policy mentoring_materials_read on storage.objects using(
 bucket_id='mentoring-materials' and exists(select 1 from public.profiles p where p.id=auth.uid() and ((p.approved and p.role='admin') or p.mentor_access))
);
create or replace function public.mentoring_ai_creator_allowed(p_run uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from meeting_ai_runs r join mentorship_meetings m on m.id=r.meeting_id join profiles p on p.id=r.created_by
 where r.id=p_run and m.archived_at is null and m.consent_given and ((p.approved and p.role='admin') or (p.mentor_access and m.mentor_user_id=p.id)))
$$;
create or replace function public.mentoring_ai_queue_ready() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and ((approved and role='admin') or mentor_access)) and exists(select 1 from mentoring_ai_worker_key)
$$;
create or replace function public.can_manage_mentoring_student(p_student uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles p where p.id=auth.uid() and ((p.approved and p.role='admin') or (p.mentor_access and exists(select 1 from mentor_assignments a where a.student_id=p_student and a.mentor_user_id=p.id and a.active))))
$$;
create or replace function public.read_notification_preferences() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('userId',p.id,'email',p.email,'role',p.role,'businessAccess',p.business_access,'mentorAccess',p.mentor_access,'emailEnabled',coalesce(n.email_enabled,true),'pushEnabled',coalesce(n.push_enabled,true),'emails',coalesce(n.emails,array[p.email])) order by p.email),'[]'::jsonb)
 from profiles p left join notification_preferences n on n.user_id=p.id where (p.approved or p.mentor_access) and (p.id=auth.uid() or exists(select 1 from profiles me where me.id=auth.uid() and me.approved and me.role='admin'))
$$;
create or replace function public.save_notification_preferences(p_user uuid,p_email_enabled boolean,p_push_enabled boolean,p_emails text[]) returns void language plpgsql security definer set search_path=public as $$
declare admin boolean; self_email text;
begin
 select (role='admin' and approved),email into admin,self_email from profiles where id=auth.uid() and (approved or mentor_access);
 if admin is null or (not admin and p_user<>auth.uid()) then raise exception 'forbidden';end if;
 if cardinality(p_emails)>10 or exists(select 1 from unnest(p_emails) e where length(e)>254 or e !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$') then raise exception 'invalid_email';end if;
 if not admin and p_emails<>array[self_email] then raise exception 'forbidden';end if;
 if not exists(select 1 from profiles where id=p_user and (approved or mentor_access)) then raise exception 'not_found';end if;
 insert into notification_preferences(user_id,email_enabled,push_enabled,emails) values(p_user,p_email_enabled,p_push_enabled,p_emails)
 on conflict(user_id) do update set email_enabled=excluded.email_enabled,push_enabled=excluded.push_enabled,emails=excluded.emails,updated_at=now();
end $$;
create or replace function public.save_mentoring_push(p_endpoint text,p_p256dh text,p_auth text,p_active boolean default true) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not exists(select 1 from profiles where id=auth.uid() and (approved or mentor_access)) then raise exception 'forbidden';end if;
 if length(p_endpoint)>2000 or p_endpoint !~ '^https://([a-z0-9-]+[.])*(push[.]apple[.]com|push[.]services[.]mozilla[.]com|fcm[.]googleapis[.]com|notify[.]windows[.]com)/' or length(p_p256dh) not between 80 and 100 or length(p_auth) not between 20 and 30 then raise exception 'invalid_subscription';end if;
 -- A browser endpoint already owned by another account must not be reassigned silently.
 if exists(select 1 from mentoring_push_subscriptions where endpoint=p_endpoint and user_id<>auth.uid() and active) then raise exception 'forbidden';end if;
 insert into mentoring_push_subscriptions(user_id,endpoint,p256dh,auth,active) values(auth.uid(),p_endpoint,p_p256dh,p_auth,p_active)
 on conflict(endpoint) do update set user_id=auth.uid(),p256dh=excluded.p256dh,auth=excluded.auth,active=excluded.active,updated_at=now() returning id into result;
 if p_active then
 insert into notification_preferences(user_id,push_enabled,emails) select id,true,array[email] from profiles where id=auth.uid()
 on conflict(user_id) do update set push_enabled=true,updated_at=now();
 end if;
 return result;
end $$;
create or replace function public.platform_notification_allowed(p_user uuid,p_event uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles p join platform_notification_events e on e.id=p_event where p.id=p_user and not e.resolved
 and (e.actor_id is null or e.actor_id<>p.id)
 and ((e.module='business' and p.approved and p.business_access) or (e.module='mentoring' and ((p.approved and p.role='admin') or (p.mentor_access and e.mentor_id=p.id))
 and not exists(select 1 from mentorship_meetings m where m.archived_at is not null and (m.id=e.entity_id or exists(select 1 from meeting_ai_runs r where r.id=e.entity_id and r.meeting_id=m.id))))))
$$;
commit;
