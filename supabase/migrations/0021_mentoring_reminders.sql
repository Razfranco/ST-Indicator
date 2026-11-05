-- Auto-complete scheduled meetings and durable, private recording reminders.
begin;
create table public.mentoring_notification_worker (
 id boolean primary key default true check(id), key_hash text not null check(length(key_hash)=64)
);
alter table public.mentoring_notification_worker enable row level security;
revoke all on public.mentoring_notification_worker from anon,authenticated;
create table public.mentoring_push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 endpoint text not null unique check(length(endpoint)<2000), p256dh text not null, auth text not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
alter table public.mentoring_push_subscriptions enable row level security;
revoke all on public.mentoring_push_subscriptions from anon,authenticated;
create table public.mentoring_recording_alerts (
 id uuid primary key default gen_random_uuid(), meeting_id uuid not null references public.mentorship_meetings(id) on delete cascade,
 starts_at timestamptz not null, created_at timestamptz not null default now(), resolved_at timestamptz,
 unique(meeting_id,starts_at)
);
alter table public.mentoring_recording_alerts enable row level security;
revoke all on public.mentoring_recording_alerts from anon,authenticated;
create table public.mentoring_alert_deliveries (
 id uuid primary key default gen_random_uuid(), alert_id uuid not null references public.mentoring_recording_alerts(id) on delete cascade,
 channel text not null check(channel in ('email','push')), destination text not null,
 subscription_id uuid references public.mentoring_push_subscriptions(id), sent_at timestamptz,
 attempts integer not null default 0, locked_until timestamptz, lease_token uuid,
 error_code text, unique(alert_id,channel,destination)
);
alter table public.mentoring_alert_deliveries enable row level security;
revoke all on public.mentoring_alert_deliveries from anon,authenticated;

create function public.mentoring_recording_missing(p_meeting uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select not exists(select 1 from public.meeting_ai_runs r join storage.objects o
 on o.bucket_id='mentoring-recordings' and o.name=r.recording_path where r.meeting_id=p_meeting)
$$;
revoke all on function public.mentoring_recording_missing(uuid) from public,anon,authenticated;

create function public.advance_mentoring_meetings() returns void
language sql security definer set search_path=public as $$
 update public.mentorship_meetings m set status='completed'
 where m.status='scheduled' and m.starts_at + make_interval(mins=>greatest(m.duration_minutes,1)) <= now()
 and public.can_access_mentoring_meeting(m.id)
$$;
revoke all on function public.advance_mentoring_meetings() from public,anon;
grant execute on function public.advance_mentoring_meetings() to authenticated;

create function public.due_mentoring_recordings() returns table(meeting_id uuid,starts_at timestamptz,student_name text)
language sql stable security definer set search_path=public as $$
 select m.id,m.starts_at,s.display_name from public.mentorship_meetings m join public.students s on s.id=m.student_id
 where m.status in ('scheduled','completed') and m.starts_at+make_interval(mins=>greatest(m.duration_minutes,1))<=now()
 and public.can_access_mentoring_meeting(m.id) and public.mentoring_recording_missing(m.id)
 order by m.starts_at desc
$$;
revoke all on function public.due_mentoring_recordings() from public,anon;
grant execute on function public.due_mentoring_recordings() to authenticated;

create function public.save_mentoring_push(p_endpoint text,p_p256dh text,p_auth text,p_active boolean default true) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not exists(select 1 from profiles where id=auth.uid() and approved and role='admin') then raise exception 'forbidden'; end if;
 if length(p_endpoint)>2000 or p_endpoint !~ '^https://([a-z0-9-]+[.])*(push[.]apple[.]com|push[.]services[.]mozilla[.]com|fcm[.]googleapis[.]com|notify[.]windows[.]com)/'
 or length(p_p256dh) not between 80 and 100 or length(p_auth) not between 20 and 30 then raise exception 'invalid_subscription'; end if;
 insert into mentoring_push_subscriptions(user_id,endpoint,p256dh,auth,active) values(auth.uid(),p_endpoint,p_p256dh,p_auth,p_active)
 on conflict(endpoint) do update set user_id=auth.uid(),p256dh=excluded.p256dh,auth=excluded.auth,active=excluded.active,updated_at=now() returning id into result;
 return result;
end $$;
revoke all on function public.save_mentoring_push(text,text,text,boolean) from public,anon;
grant execute on function public.save_mentoring_push(text,text,text,boolean) to authenticated;

create function public.claim_mentoring_alert_deliveries(p_key text,p_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if length(p_key)<>64 or not exists(select 1 from mentoring_notification_worker where key_hash=encode(sha256(convert_to(p_key,'UTF8')),'hex')) then raise exception 'unauthorized'; end if;
 -- The requested business rule is intentional: manual cancellations/no-shows remain unchanged.
 update mentorship_meetings m set status='completed' where m.status='scheduled' and m.starts_at+make_interval(mins=>greatest(m.duration_minutes,1))<=now();
 update mentoring_recording_alerts a set resolved_at=now() where a.resolved_at is null and not exists(
 select 1 from mentorship_meetings m where m.id=a.meeting_id and m.starts_at=a.starts_at and m.status='completed'
 and m.starts_at+make_interval(mins=>greatest(m.duration_minutes,1))<=now() and mentoring_recording_missing(m.id));
 insert into mentoring_recording_alerts(meeting_id,starts_at)
 select m.id,m.starts_at from mentorship_meetings m where m.status='completed'
 and m.starts_at+make_interval(mins=>greatest(m.duration_minutes,1))<=now() and mentoring_recording_missing(m.id)
 on conflict(meeting_id,starts_at) do nothing;
 -- One email per meeting occurrence, and one push per opted-in administrator device.
 insert into mentoring_alert_deliveries(alert_id,channel,destination)
 select id,'email','sharktrade55@gmail.com' from mentoring_recording_alerts where resolved_at is null
 on conflict do nothing;
 insert into mentoring_alert_deliveries(alert_id,channel,destination,subscription_id)
 select a.id,'push',s.id::text,s.id from mentoring_recording_alerts a cross join mentoring_push_subscriptions s
 join profiles p on p.id=s.user_id where a.resolved_at is null and s.active and p.approved and p.role='admin'
 on conflict do nothing;
 with picked as (
 select d.id from mentoring_alert_deliveries d join mentoring_recording_alerts a on a.id=d.alert_id
 where a.resolved_at is null and d.sent_at is null and d.attempts<6 and (d.locked_until is null or d.locked_until<now())
 and (d.channel='email' or exists(select 1 from mentoring_push_subscriptions s join profiles p on p.id=s.user_id where s.id=d.subscription_id and s.active and p.approved and p.role='admin'))
 order by a.created_at,d.channel for update of d skip locked limit 20
 ), claimed as (
 update mentoring_alert_deliveries d set lease_token=p_token,locked_until=now()+interval '5 minutes',attempts=attempts+1
 from picked where d.id=picked.id returning d.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'alertId',a.id,'meetingId',m.id,'startsAt',m.starts_at,'studentName',st.display_name,
 'channel',d.channel,'subscription',case when d.channel='push' then jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth)) else null end)), '[]'::jsonb)
 into result from claimed d join mentoring_recording_alerts a on a.id=d.alert_id join mentorship_meetings m on m.id=a.meeting_id
 join students st on st.id=m.student_id left join mentoring_push_subscriptions s on s.id=d.subscription_id;
 return result;
end $$;
revoke all on function public.claim_mentoring_alert_deliveries(text,uuid) from public,authenticated;
grant execute on function public.claim_mentoring_alert_deliveries(text,uuid) to anon;

create function public.finish_mentoring_alert_delivery(p_key text,p_id uuid,p_token uuid,p_success boolean,p_expired boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare subscription uuid;
begin
 if length(p_key)<>64 or not exists(select 1 from mentoring_notification_worker where key_hash=encode(sha256(convert_to(p_key,'UTF8')),'hex')) then raise exception 'unauthorized'; end if;
 update mentoring_alert_deliveries set sent_at=case when p_success then now() else null end,
 error_code=case when p_success then null else 'provider_failed' end,locked_until=case when p_success then null else now()+interval '5 minutes' end,
 lease_token=null where id=p_id and lease_token=p_token returning subscription_id into subscription;
 if p_expired and subscription is not null then update mentoring_push_subscriptions set active=false,updated_at=now() where id=subscription; end if;
end $$;
revoke all on function public.finish_mentoring_alert_delivery(text,uuid,uuid,boolean,boolean) from public,authenticated;
grant execute on function public.finish_mentoring_alert_delivery(text,uuid,uuid,boolean,boolean) to anon;
commit;
