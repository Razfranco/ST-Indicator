begin;
create table public.notification_preferences(
 user_id uuid primary key references public.profiles(id), email_enabled boolean not null default true,push_enabled boolean not null default true,
 emails text[] not null default '{}',updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon,authenticated;
insert into public.notification_preferences(user_id,emails)
select id,array[case when lower(email)='francoraz827@gmail.com' then 'sharktrade55@gmail.com' else email end] from public.profiles where approved;
create table public.mentoring_week_exceptions(
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),week_start date not null,
 reason text not null check(length(trim(reason)) between 3 and 2000),created_by uuid not null references public.profiles(id),updated_at timestamptz not null default now(),
 unique(student_id,week_start),check(extract(dow from week_start)=0)
);
alter table public.mentoring_week_exceptions enable row level security;
revoke all on public.mentoring_week_exceptions from anon,authenticated;
create function public.can_manage_mentoring_student(p_student uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles p where p.id=auth.uid() and p.approved and (p.role='admin' or (p.mentor_access and exists(select 1 from mentor_assignments a where a.student_id=p_student and a.mentor_user_id=p.id and a.active))))
$$;
revoke all on function public.can_manage_mentoring_student(uuid) from public,anon;
grant execute on function public.can_manage_mentoring_student(uuid) to authenticated;
create function public.save_mentoring_week_exception(p_student uuid,p_week date,p_reason text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not can_manage_mentoring_student(p_student) then raise exception 'forbidden';end if;
 if extract(dow from p_week)<>0 or length(trim(p_reason)) not between 3 and 2000 then raise exception 'reason_required';end if;
 insert into mentoring_week_exceptions(student_id,week_start,reason,created_by) values(p_student,p_week,trim(p_reason),auth.uid())
 on conflict(student_id,week_start) do update set reason=excluded.reason,created_by=auth.uid(),updated_at=now();
end $$;
create function public.list_mentoring_week_exceptions(p_week date) returns setof public.mentoring_week_exceptions language sql stable security definer set search_path=public as $$
 select * from mentoring_week_exceptions e where e.week_start=p_week and can_manage_mentoring_student(e.student_id)
$$;
revoke all on function public.save_mentoring_week_exception(uuid,date,text),public.list_mentoring_week_exceptions(date) from public,anon;
grant execute on function public.save_mentoring_week_exception(uuid,date,text),public.list_mentoring_week_exceptions(date) to authenticated;
create function public.read_notification_preferences() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('userId',p.id,'email',p.email,'role',p.role,'businessAccess',p.business_access,'mentorAccess',p.mentor_access,'emailEnabled',coalesce(n.email_enabled,true),'pushEnabled',coalesce(n.push_enabled,true),'emails',coalesce(n.emails,array[p.email])) order by p.email),'[]'::jsonb)
 from profiles p left join notification_preferences n on n.user_id=p.id where p.approved and (p.id=auth.uid() or exists(select 1 from profiles me where me.id=auth.uid() and me.approved and me.role='admin'))
$$;
create function public.save_notification_preferences(p_user uuid,p_email_enabled boolean,p_push_enabled boolean,p_emails text[]) returns void language plpgsql security definer set search_path=public as $$
declare admin boolean; self_email text;
begin
 select role='admin',email into admin,self_email from profiles where id=auth.uid() and approved;
 if admin is null or (not admin and p_user<>auth.uid()) then raise exception 'forbidden';end if;
 if cardinality(p_emails)>10 or exists(select 1 from unnest(p_emails) e where length(e)>254 or e !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$') then raise exception 'invalid_email';end if;
 if not admin and p_emails<>array[self_email] then raise exception 'forbidden';end if;
 if not exists(select 1 from profiles where id=p_user and approved) then raise exception 'not_found';end if;
 insert into notification_preferences(user_id,email_enabled,push_enabled,emails) values(p_user,p_email_enabled,p_push_enabled,p_emails)
 on conflict(user_id) do update set email_enabled=excluded.email_enabled,push_enabled=excluded.push_enabled,emails=excluded.emails,updated_at=now();
end $$;
revoke all on function public.read_notification_preferences(),public.save_notification_preferences(uuid,boolean,boolean,text[]) from public,anon;
grant execute on function public.read_notification_preferences(),public.save_notification_preferences(uuid,boolean,boolean,text[]) to authenticated;
create or replace function public.save_mentoring_push(p_endpoint text,p_p256dh text,p_auth text,p_active boolean default true) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not exists(select 1 from profiles where id=auth.uid() and approved and (role='admin' or mentor_access or business_access)) then raise exception 'forbidden';end if;
 if length(p_endpoint)>2000 or p_endpoint !~ '^https://([a-z0-9-]+[.])*(push[.]apple[.]com|push[.]services[.]mozilla[.]com|fcm[.]googleapis[.]com|notify[.]windows[.]com)/' or length(p_p256dh) not between 80 and 100 or length(p_auth) not between 20 and 30 then raise exception 'invalid_subscription';end if;
 insert into mentoring_push_subscriptions(user_id,endpoint,p256dh,auth,active) values(auth.uid(),p_endpoint,p_p256dh,p_auth,p_active)
 on conflict(endpoint) do update set user_id=auth.uid(),p256dh=excluded.p256dh,auth=excluded.auth,active=excluded.active,updated_at=now() returning id into result;return result;
end $$;
create table public.platform_notification_events(
 id uuid primary key default gen_random_uuid(),event_key text not null unique,module text not null check(module in ('mentoring','business')),
 kind text not null,entity_id uuid not null,mentor_id uuid,actor_id uuid,starts_at timestamptz,expires_on date,
 subject text not null,body text not null,path text not null,created_at timestamptz not null default now(),resolved boolean not null default false
);
alter table public.platform_notification_events enable row level security;
revoke all on public.platform_notification_events from anon,authenticated;
create table public.platform_notification_deliveries(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.platform_notification_events(id),user_id uuid not null references public.profiles(id),
 channel text not null check(channel in ('email','push')),destination text not null,subscription_id uuid references public.mentoring_push_subscriptions(id),
 attempts integer not null default 0,sent_at timestamptz,locked_until timestamptz,lease_token uuid,error_code text,
 unique(event_id,channel,destination)
);
alter table public.platform_notification_deliveries enable row level security;
revoke all on public.platform_notification_deliveries from anon,authenticated;
create function public.platform_notification_allowed(p_user uuid,p_event uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles p join platform_notification_events e on e.id=p_event where p.id=p_user and p.approved and not e.resolved
 and (e.actor_id is null or e.actor_id<>p.id)
 and ((e.module='business' and p.business_access) or (e.module='mentoring' and (p.role='admin' or (p.mentor_access and e.mentor_id=p.id)))))
$$;
revoke all on function public.platform_notification_allowed(uuid,uuid) from public,anon,authenticated;
create function public.queue_meeting_scheduled_notification() returns trigger language plpgsql security definer set search_path=public as $$
declare name text;
begin
 if new.status='scheduled' and new.starts_at>now() and (TG_OP='INSERT' or new.starts_at is distinct from old.starts_at or new.student_id is distinct from old.student_id or new.mentor_user_id is distinct from old.mentor_user_id) then
 select display_name into name from students where id=new.student_id;
 insert into platform_notification_events(event_key,module,kind,entity_id,mentor_id,actor_id,starts_at,subject,body,path)
 values('meeting-scheduled:'||new.id||':'||new.starts_at||':'||new.mentor_user_id,'mentoring','meeting_scheduled',new.id,new.mentor_user_id,auth.uid(),new.starts_at,'נקבעה פגישת ליווי',coalesce(name,'תלמיד')||' · '||to_char(new.starts_at at time zone 'Asia/Jerusalem','DD/MM/YYYY HH24:MI'),'/mentoring/meetings/'||new.id||'/edit') on conflict(event_key) do nothing;
 end if;return new;
end $$;
revoke all on function public.queue_meeting_scheduled_notification() from public,anon,authenticated;
create trigger meeting_scheduled_notification after insert or update of starts_at,student_id,mentor_user_id on public.mentorship_meetings for each row execute function public.queue_meeting_scheduled_notification();
create function public.claim_platform_notifications(p_key text,p_token uuid,p_external jsonb default '[]') returns jsonb
language plpgsql security definer set search_path=public as $$
declare today date:=(now() at time zone 'Asia/Jerusalem')::date; item record; ext jsonb; key text; result jsonb; days integer;
begin
 if length(p_key)<>64 or not exists(select 1 from mentoring_notification_worker where key_hash=encode(sha256(convert_to(p_key,'UTF8')),'hex')) then raise exception 'unauthorized';end if;
 if p_external is not null and (jsonb_typeof(p_external)<>'array' or jsonb_array_length(p_external)>1000) then raise exception 'invalid';end if;
 update mentorship_meetings m set status='completed' where m.status='scheduled' and m.starts_at+make_interval(mins=>greatest(m.duration_minutes,1))<=now();
 update platform_notification_events e set resolved=true where not e.resolved and (
 (e.kind='recording_missing' and not exists(select 1 from mentorship_meetings m where m.id=e.entity_id and m.starts_at=e.starts_at and m.status='completed' and mentoring_recording_missing(m.id))) or
 (e.kind='meeting_scheduled' and not exists(select 1 from mentorship_meetings m where m.id=e.entity_id and m.starts_at=e.starts_at and m.mentor_user_id=e.mentor_id and m.status in('scheduled','completed') and m.starts_at>=now())) or
 (e.kind like 'subscription_%' and not exists(select 1 from customers c where c.id=e.entity_id and c.status='active' and c.frozen_at is null and c.subscription_end_date=e.expires_on and e.expires_on>=today)) or
 (e.kind in('trial_week','trial_today') and not exists(select 1 from leads l where l.id=e.entity_id and l.status='trial_week' and l.trial_week_expiry=e.expires_on and e.expires_on>=today)) or
 (e.kind like 'website_trial_%' and p_external is not null));
 insert into platform_notification_events(event_key,module,kind,entity_id,mentor_id,starts_at,subject,body,path)
 select 'recording:'||m.id||':'||m.starts_at,'mentoring','recording_missing',m.id,m.mentor_user_id,m.starts_at,'פגישת ליווי ללא הקלטה',s.display_name||' · '||to_char(m.starts_at at time zone 'Asia/Jerusalem','DD/MM/YYYY HH24:MI'),'/mentoring/meetings/'||m.id||'/edit'
 from mentorship_meetings m join students s on s.id=m.student_id where m.status='completed' and m.starts_at+make_interval(mins=>greatest(m.duration_minutes,1))<=now() and mentoring_recording_missing(m.id)
 on conflict(event_key) do update set mentor_id=excluded.mentor_id;
 for item in
 select c.id,c.full_name as name,c.subscription_end_date as expires,'subscription'::text as category,'/business/customers/'||c.id||'/edit' as path from customers c where c.status='active' and c.frozen_at is null and c.subscription_end_date between today and today+7
 union all select l.id,l.full_name,l.trial_week_expiry,'trial','/business/trials?focus='||l.id from leads l where l.status='trial_week' and l.trial_week_expiry between today and today+7
 loop
 days:=item.expires-today;key:=item.category||case when days=0 then '_today:' else '_week:' end||item.id||':'||item.expires;
 insert into platform_notification_events(event_key,module,kind,entity_id,expires_on,subject,body,path)
 values(key,'business',item.category||case when days=0 then '_today' else '_week' end,item.id,item.expires,
 case when item.category='subscription' then 'מנוי' else 'תקופת ניסיון' end||case when days=0 then ' מסתיים היום' else ' מסתיים בתוך שבוע' end,
 item.name||' · תוקף: '||to_char(item.expires,'DD/MM/YYYY'),item.path) on conflict(event_key) do nothing;
 end loop;
 for ext in select value from jsonb_array_elements(coalesce(p_external,'[]'::jsonb)) loop
 if (ext->>'expiresOn')::date not between today and today+7 then continue;end if;
 days:=(ext->>'expiresOn')::date-today;key:='website_trial'||case when days=0 then '_today:' else '_week:' end||(ext->>'id')||':'||(ext->>'expiresOn');
 insert into platform_notification_events(event_key,module,kind,entity_id,expires_on,subject,body,path)
 values(key,'business',case when days=0 then 'website_trial_today' else 'website_trial_week' end,(ext->>'id')::uuid,(ext->>'expiresOn')::date,
 case when days=0 then 'ניסיון מהקורס מסתיים היום' else 'ניסיון מהקורס מסתיים בתוך שבוע' end,left(ext->>'name',200)||' · תוקף: '||(ext->>'expiresOn'),'/business/trials')
 on conflict(event_key) do update set resolved=false;
 end loop;
 insert into platform_notification_deliveries(event_id,user_id,channel,destination,sent_at)
 select e.id,p.id,'email',lower(trim(dest)),(
 select max(d.sent_at) from mentoring_recording_alerts a join mentoring_alert_deliveries d on d.alert_id=a.id where e.kind='recording_missing' and a.meeting_id=e.entity_id and a.starts_at=e.starts_at and d.channel='email' and lower(d.destination)=lower(trim(dest)))
 from platform_notification_events e cross join profiles p left join notification_preferences n on n.user_id=p.id
 cross join lateral unnest(coalesce(n.emails,array[p.email])) dest
 where platform_notification_allowed(p.id,e.id) and coalesce(n.email_enabled,true) and not exists(select 1 from profiles other where lower(other.email)=lower(trim(dest)) and not platform_notification_allowed(other.id,e.id))
 on conflict(event_id,channel,destination) do nothing;
 insert into platform_notification_deliveries(event_id,user_id,channel,destination,subscription_id)
 select e.id,p.id,'push',s.id::text,s.id from platform_notification_events e cross join mentoring_push_subscriptions s
 join profiles p on p.id=s.user_id left join notification_preferences n on n.user_id=p.id
 where s.active and platform_notification_allowed(p.id,e.id) and coalesce(n.push_enabled,true)
 on conflict(event_id,channel,destination) do nothing;
 with picked as (
 select d.id from platform_notification_deliveries d join platform_notification_events e on e.id=d.event_id
 join profiles p on p.id=d.user_id left join notification_preferences n on n.user_id=p.id
 where d.sent_at is null and d.attempts<6 and (d.locked_until is null or d.locked_until<now()) and platform_notification_allowed(p.id,e.id) and (e.kind not like 'website_trial_%' or p_external is not null)
 and ((d.channel='email' and coalesce(n.email_enabled,true) and d.destination=any(coalesce(n.emails,array[p.email]))) or
 (d.channel='push' and coalesce(n.push_enabled,true) and exists(select 1 from mentoring_push_subscriptions s where s.id=d.subscription_id and s.active and s.user_id=p.id)))
 order by e.created_at for update of d skip locked limit 20
 ), claimed as (update platform_notification_deliveries d set lease_token=p_token,locked_until=now()+interval '5 minutes',attempts=attempts+1 from picked where d.id=picked.id returning d.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'alertId',e.id,'meetingId',e.entity_id,'startsAt',coalesce(e.starts_at,e.created_at),'studentName',e.body,'subject',e.subject,'body',e.body,'path',e.path,'module',e.module,'destination',d.destination,'channel',d.channel,
 'subscription',case when d.channel='push' then jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth)) else null end)),'[]'::jsonb)
 into result from claimed d join platform_notification_events e on e.id=d.event_id left join mentoring_push_subscriptions s on s.id=d.subscription_id;
 return result;
end $$;
create function public.finish_platform_notification(p_key text,p_id uuid,p_token uuid,p_success boolean,p_expired boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare subscription uuid;
begin
 if length(p_key)<>64 or not exists(select 1 from mentoring_notification_worker where key_hash=encode(sha256(convert_to(p_key,'UTF8')),'hex')) then raise exception 'unauthorized';end if;
 update platform_notification_deliveries set sent_at=case when p_success then now() else null end,error_code=case when p_success then null else 'provider_failed' end,
 locked_until=case when p_success then null else now()+interval '5 minutes' end,lease_token=null where id=p_id and lease_token=p_token returning subscription_id into subscription;
 if p_expired and subscription is not null then update mentoring_push_subscriptions set active=false,updated_at=now() where id=subscription;end if;
end $$;
revoke all on function public.claim_platform_notifications(text,uuid,jsonb),public.finish_platform_notification(text,uuid,uuid,boolean,boolean) from public,authenticated;
grant execute on function public.claim_platform_notifications(text,uuid,jsonb),public.finish_platform_notification(text,uuid,uuid,boolean,boolean) to anon;
-- Retire the first-stage queue so settings apply to every scheduled platform alert.
create or replace function public.claim_mentoring_alert_deliveries(p_key text,p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if length(p_key)<>64 or not exists(select 1 from mentoring_notification_worker where key_hash=encode(sha256(convert_to(p_key,'UTF8')),'hex')) then raise exception 'unauthorized';end if;
 return '[]'::jsonb;
end $$;
commit;
