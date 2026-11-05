begin;
-- Any approved account may register its own device. Event routing remains role-scoped.
create or replace function public.save_mentoring_push(p_endpoint text,p_p256dh text,p_auth text,p_active boolean default true) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not exists(select 1 from profiles where id=auth.uid() and approved) then raise exception 'forbidden';end if;
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
commit;
