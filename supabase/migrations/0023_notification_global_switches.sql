begin;
create table public.notification_global_settings(id boolean primary key default true check(id),email_enabled boolean not null default true,push_enabled boolean not null default true);
insert into public.notification_global_settings(id) values(true);
alter table public.notification_global_settings enable row level security;
revoke all on public.notification_global_settings from anon,authenticated;
create function public.read_notification_global_settings() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('emailEnabled',email_enabled,'pushEnabled',push_enabled) from notification_global_settings where id and exists(select 1 from profiles where id=auth.uid() and approved)
$$;
create function public.save_notification_global_settings(p_email boolean,p_push boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from profiles where id=auth.uid() and approved and role='admin') then raise exception 'forbidden';end if;
 update notification_global_settings set email_enabled=p_email,push_enabled=p_push where id;
end $$;
create function public.notification_channel_enabled(p_channel text) returns boolean language sql stable security definer set search_path=public as $$
 select case when p_channel='email' then email_enabled else push_enabled end from notification_global_settings where id
$$;
revoke all on function public.read_notification_global_settings(),public.save_notification_global_settings(boolean,boolean),public.notification_channel_enabled(text) from public,anon,authenticated;
grant execute on function public.read_notification_global_settings(),public.save_notification_global_settings(boolean,boolean) to authenticated;
create or replace function public.claim_platform_notifications(p_key text,p_token uuid,p_external jsonb default '[]') returns jsonb
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
 where d.sent_at is null and d.attempts<6 and (d.locked_until is null or d.locked_until<now()) and platform_notification_allowed(p.id,e.id) and public.notification_channel_enabled(d.channel) and (e.kind not like 'website_trial_%' or p_external is not null)
 and ((d.channel='email' and coalesce(n.email_enabled,true) and d.destination=any(coalesce(n.emails,array[p.email]))) or
 (d.channel='push' and coalesce(n.push_enabled,true) and exists(select 1 from mentoring_push_subscriptions s where s.id=d.subscription_id and s.active and s.user_id=p.id)))
 order by e.created_at for update of d skip locked limit 20
 ), claimed as (update platform_notification_deliveries d set lease_token=p_token,locked_until=now()+interval '5 minutes',attempts=attempts+1 from picked where d.id=picked.id returning d.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'alertId',e.id,'meetingId',e.entity_id,'startsAt',coalesce(e.starts_at,e.created_at),'studentName',e.body,'subject',e.subject,'body',e.body,'path',e.path,'module',e.module,'destination',d.destination,'channel',d.channel,
 'subscription',case when d.channel='push' then jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth)) else null end)),'[]'::jsonb)
 into result from claimed d join platform_notification_events e on e.id=d.event_id left join mentoring_push_subscriptions s on s.id=d.subscription_id;
 return result;
end $$;

commit;
