begin;
alter table public.mentoring_ai_settings drop constraint mentoring_ai_settings_instructions_check;
alter table public.mentoring_ai_settings add check(length(instructions) between 1 and 60000);
alter table public.mentoring_ai_settings drop constraint mentoring_ai_settings_examples_check;
alter table public.mentoring_ai_settings add check(length(examples)<=140000);
alter table public.mentoring_ai_settings add column source_documents jsonb not null default '[]';

create table public.meeting_transcript_versions (
 id uuid primary key default gen_random_uuid(),meeting_id uuid not null references public.mentorship_meetings(id) on delete cascade,
 transcript_text text not null,filename text,uploaded_at timestamptz not null,uploaded_by uuid not null references auth.users(id)
);
alter table public.meeting_transcript_versions enable row level security;
create policy transcript_versions_read on public.meeting_transcript_versions for select to authenticated using(public.can_access_mentoring_meeting(meeting_id));
revoke all on public.meeting_transcript_versions from anon,authenticated;
grant select on public.meeting_transcript_versions to authenticated;
insert into public.meeting_transcript_versions(meeting_id,transcript_text,filename,uploaded_at,uploaded_by) select meeting_id,transcript_text,filename,uploaded_at,uploaded_by from public.meeting_transcripts;
create function public.archive_mentoring_transcript() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' or new.transcript_text is distinct from old.transcript_text then
 insert into meeting_transcript_versions(meeting_id,transcript_text,filename,uploaded_at,uploaded_by) values(new.meeting_id,new.transcript_text,new.filename,new.uploaded_at,new.uploaded_by);
 end if;return new;
end $$;
create trigger archive_mentoring_transcript after insert or update on public.meeting_transcripts for each row execute function public.archive_mentoring_transcript();

create table public.meeting_summary_reviews (
 id uuid primary key default gen_random_uuid(),run_id uuid not null references public.meeting_ai_runs(id) on delete cascade,
 meeting_id uuid not null references public.mentorship_meetings(id) on delete cascade,reviewed_text text not null,
 reviewed_at timestamptz not null,reviewed_by uuid not null references auth.users(id),pdf_path text
);
alter table public.meeting_summary_reviews enable row level security;
create policy summary_reviews_read on public.meeting_summary_reviews for select to authenticated using(public.can_access_mentoring_meeting(meeting_id));
revoke all on public.meeting_summary_reviews from anon,authenticated;
grant select on public.meeting_summary_reviews to authenticated;
create function public.archive_mentoring_review() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.reviewed_at is distinct from old.reviewed_at and new.reviewed_text is not null then
 insert into meeting_summary_reviews(run_id,meeting_id,reviewed_text,reviewed_at,reviewed_by) values(new.id,new.meeting_id,new.reviewed_text,new.reviewed_at,new.reviewed_by);
 end if;return new;
end $$;
create trigger archive_mentoring_review after update on public.meeting_ai_runs for each row execute function public.archive_mentoring_review();

create table public.mentoring_student_profiles (
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id) on delete cascade,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),source_runs uuid[] not null,
 source_fingerprint text not null,status text not null default 'pending' check(status in ('pending','processing','completed','failed')),
 result jsonb,error_code text,lease_token uuid,locked_until timestamptz,attempts integer not null default 0,
 reviewed_at timestamptz,reviewed_by uuid references auth.users(id),
 unique(student_id,source_fingerprint,created_by)
);
alter table public.mentoring_student_profiles enable row level security;
create policy mentoring_profile_read on public.mentoring_student_profiles for select to authenticated using(
 cardinality(source_runs)>0 and not exists(select 1 from unnest(source_runs) s(id) where not exists(select 1 from public.meeting_ai_runs r where r.id=s.id and public.can_access_mentoring_meeting(r.meeting_id)))
);
revoke all on public.mentoring_student_profiles from anon,authenticated;
grant select on public.mentoring_student_profiles to authenticated;

create function public.claim_mentoring_student_profile(p_student uuid,p_sources uuid[],p_fingerprint text,p_token uuid)
returns setof public.mentoring_student_profiles language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
 if cardinality(p_sources)<1 or cardinality(p_sources)>200 or length(p_fingerprint)<>64 then raise exception 'profile_invalid'; end if;
 if exists(select 1 from unnest(p_sources) s(id) where not exists(select 1 from meeting_ai_runs r join mentorship_meetings m on m.id=r.meeting_id where r.id=s.id and m.student_id=p_student and r.reviewed_at is not null and r.status='completed' and public.can_access_mentoring_meeting(m.id))) then raise exception 'not_found'; end if;
 insert into mentoring_student_profiles(student_id,created_by,source_runs,source_fingerprint) values(p_student,auth.uid(),p_sources,p_fingerprint)
 on conflict(student_id,source_fingerprint,created_by) do nothing;
 select id into rid from mentoring_student_profiles where student_id=p_student and source_fingerprint=p_fingerprint and created_by=auth.uid();
 return query update mentoring_student_profiles set status='processing',lease_token=p_token,locked_until=now()+interval '5 minutes',attempts=attempts+1,error_code=null
 where id=rid and status<>'completed' and attempts<3 and (locked_until is null or locked_until<now()) returning *;
end $$;
create function public.finish_mentoring_student_profile(p_id uuid,p_token uuid,p_result jsonb default null,p_error text default null)
returns setof public.mentoring_student_profiles language plpgsql security definer set search_path=public as $$
begin
 if p_error is not null and p_error not in ('profile_invalid','processing_failed','ai_limit','ai_key','ai_unavailable','summary_incomplete','summary_refused','summary_invalid') then raise exception 'invalid_error'; end if;
 if p_result is not null and length(p_result::text)>120000 then raise exception 'profile_invalid'; end if;
 return query update mentoring_student_profiles set status=case when p_error is null then 'completed' else 'failed' end,result=p_result,error_code=p_error,lease_token=null,locked_until=null
 where id=p_id and lease_token=p_token and created_by=auth.uid() returning *;
end $$;
create function public.review_mentoring_student_profile(p_id uuid)
returns setof public.mentoring_student_profiles language plpgsql security definer set search_path=public as $$
begin
 return query update mentoring_student_profiles p set reviewed_at=now(),reviewed_by=auth.uid()
 where p.id=p_id and p.status='completed' and cardinality(p.source_runs)>0 and not exists(select 1 from unnest(p.source_runs) s(id) where not exists(select 1 from meeting_ai_runs r where r.id=s.id and public.can_access_mentoring_meeting(r.meeting_id))) returning p.*;
end $$;
revoke all on function public.claim_mentoring_student_profile(uuid,uuid[],text,uuid),public.finish_mentoring_student_profile(uuid,uuid,jsonb,text),public.review_mentoring_student_profile(uuid),public.archive_mentoring_transcript(),public.archive_mentoring_review() from public,anon;
grant execute on function public.claim_mentoring_student_profile(uuid,uuid[],text,uuid),public.finish_mentoring_student_profile(uuid,uuid,jsonb,text),public.review_mentoring_student_profile(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit) values('mentoring-materials','mentoring-materials',false,20000000),('mentoring-documents','mentoring-documents',false,20000000);
create policy mentoring_materials_read on storage.objects for select to authenticated using(bucket_id='mentoring-materials' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.approved and (p.role='admin' or p.mentor_access)));
create policy mentoring_materials_insert on storage.objects for insert to authenticated with check(bucket_id='mentoring-materials' and public.is_admin());
create policy mentoring_documents_read on storage.objects for select to authenticated using(bucket_id='mentoring-documents' and exists(select 1 from public.meeting_summary_reviews r where r.pdf_path=name and public.can_access_mentoring_meeting(r.meeting_id)));
create policy mentoring_documents_insert on storage.objects for insert to authenticated with check(bucket_id='mentoring-documents' and exists(select 1 from public.meeting_summary_reviews r where name=r.meeting_id::text||'/'||r.id::text||'.pdf' and public.can_access_mentoring_meeting(r.meeting_id)));
create function public.attach_mentoring_pdf(p_review uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update meeting_summary_reviews set pdf_path=meeting_id::text||'/'||id::text||'.pdf' where id=p_review and public.can_access_mentoring_meeting(meeting_id) and exists(select 1 from storage.objects o where o.bucket_id='mentoring-documents' and o.name=meeting_id::text||'/'||p_review::text||'.pdf');
end $$;
revoke all on function public.attach_mentoring_pdf(uuid) from public,anon;
grant execute on function public.attach_mentoring_pdf(uuid) to authenticated;
commit;
