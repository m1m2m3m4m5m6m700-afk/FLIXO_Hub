-- FLIXO Hub Agent-1 closure for RT-01, RT-02, RT-10, RT-18.
-- Ordered after the current execution branch migrations.

alter function public.enforce_council_dispatch_priority() set search_path = pg_catalog, public, pg_temp;
alter function public.flixo_council_assistant_wake_notify() set search_path = pg_catalog, public, pg_temp;
alter function public.flixo_retry_pending_assistant_wakes() set search_path = pg_catalog, public, pg_temp;
alter function public.flixo_claim_due_agent_schedules(integer, timestamptz) set search_path = pg_catalog, public, pg_temp;
alter function public.council_recover_expired_dispatches(integer) set search_path = pg_catalog, public, pg_temp;
alter function public.flixo_auto_wake_stale_master3() set search_path = pg_catalog, public, pg_temp;
alter function public.council_claim_dispatch(text) set search_path = pg_catalog, public, pg_temp;
alter function public.council_ack_dispatch(uuid, text, text, text) set search_path = pg_catalog, public, pg_temp;
alter function public.council_heartbeat_dispatch(uuid, text, text, text) set search_path = pg_catalog, public, pg_temp;
alter function public.council_complete_dispatch(uuid, text, text, text, text, jsonb, jsonb) set search_path = pg_catalog, public, pg_temp;
alter function public.council_claim_assistant_wake(text, text, text) set search_path = pg_catalog, public, pg_temp;
alter function public.council_dispatch_assistant_wake(uuid, text) set search_path = pg_catalog, public, pg_temp;

revoke execute on function public.enforce_council_dispatch_priority() from public, anon, authenticated;
grant execute on function public.enforce_council_dispatch_priority() to service_role;
revoke execute on function public.flixo_council_assistant_wake_notify() from public, anon, authenticated;
grant execute on function public.flixo_council_assistant_wake_notify() to service_role;
revoke execute on function public.flixo_retry_pending_assistant_wakes() from public, anon, authenticated;
grant execute on function public.flixo_retry_pending_assistant_wakes() to service_role;
revoke execute on function public.flixo_claim_due_agent_schedules(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.flixo_claim_due_agent_schedules(integer, timestamptz) to service_role;
revoke execute on function public.council_recover_expired_dispatches(integer) from public, anon, authenticated;
grant execute on function public.council_recover_expired_dispatches(integer) to service_role;
revoke execute on function public.flixo_auto_wake_stale_master3() from public, anon, authenticated;
grant execute on function public.flixo_auto_wake_stale_master3() to service_role;
revoke execute on function public.council_claim_dispatch(text) from public, anon, authenticated;
grant execute on function public.council_claim_dispatch(text) to service_role;
revoke execute on function public.council_ack_dispatch(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.council_ack_dispatch(uuid, text, text, text) to service_role;
revoke execute on function public.council_heartbeat_dispatch(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.council_heartbeat_dispatch(uuid, text, text, text) to service_role;
revoke execute on function public.council_complete_dispatch(uuid, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.council_complete_dispatch(uuid, text, text, text, text, jsonb, jsonb) to service_role;
revoke execute on function public.council_claim_assistant_wake(text, text, text) from public, anon, authenticated;
grant execute on function public.council_claim_assistant_wake(text, text, text) to service_role;
revoke execute on function public.council_dispatch_assistant_wake(uuid, text) from public, anon, authenticated;
grant execute on function public.council_dispatch_assistant_wake(uuid, text) to service_role;

-- Supabase-managed pg_net functions are platform-owned and their PUBLIC ACL cannot
-- be changed per-project. The repository-controlled SECURITY DEFINER callers above
-- remain service_role-only. Direct pg_net exposure is a platform/config hard-stop:
-- the net schema must remain outside the Data API exposed schema set.

create table if not exists public.flix_admin_login_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint flix_admin_login_rate_limits_key_check check (length(bucket_key) between 3 and 128),
  constraint flix_admin_login_rate_limits_attempts_check check (attempts >= 0)
);
create index if not exists flix_admin_login_rate_limits_updated_idx on public.flix_admin_login_rate_limits (updated_at);
alter table public.flix_admin_login_rate_limits enable row level security;
revoke all on table public.flix_admin_login_rate_limits from public, anon, authenticated, service_role;

create or replace function public.flixo_admin_login_rate_limit_consume(
  p_bucket_key text, p_limit integer default 10, p_window_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $function$
declare current_attempts integer; current_window timestamptz;
begin
  if p_bucket_key is null or length(trim(p_bucket_key)) < 3 or length(trim(p_bucket_key)) > 128 then raise exception 'ADMIN_LOGIN_RATE_LIMIT_KEY_INVALID'; end if;
  if p_limit < 1 or p_limit > 100 then raise exception 'ADMIN_LOGIN_RATE_LIMIT_LIMIT_INVALID'; end if;
  if p_window_seconds < 1 or p_window_seconds > 3600 then raise exception 'ADMIN_LOGIN_RATE_LIMIT_WINDOW_INVALID'; end if;
  delete from public.flix_admin_login_rate_limits
   where updated_at < clock_timestamp() - interval '15 minutes' and bucket_key <> p_bucket_key;
  insert into public.flix_admin_login_rate_limits(bucket_key, window_started_at, attempts, updated_at)
  values (trim(p_bucket_key), clock_timestamp(), 1, clock_timestamp())
  on conflict (bucket_key) do update
     set attempts = case
       when public.flix_admin_login_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= clock_timestamp()
       then 1 else public.flix_admin_login_rate_limits.attempts + 1 end,
       window_started_at = case
       when public.flix_admin_login_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= clock_timestamp()
       then clock_timestamp() else public.flix_admin_login_rate_limits.window_started_at end,
       updated_at = clock_timestamp()
  returning attempts, window_started_at into current_attempts, current_window;
  return jsonb_build_object('allowed', current_attempts <= p_limit, 'attempts', current_attempts, 'resetAt', current_window + make_interval(secs => p_window_seconds));
end;
$function$;

create or replace function public.flixo_admin_login_rate_limit_reset(p_bucket_key text)
returns void
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $function$
begin
  if p_bucket_key is null or length(trim(p_bucket_key)) < 3 or length(trim(p_bucket_key)) > 128 then raise exception 'ADMIN_LOGIN_RATE_LIMIT_KEY_INVALID'; end if;
  delete from public.flix_admin_login_rate_limits where bucket_key = trim(p_bucket_key);
end;
$function$;

revoke execute on function public.flixo_admin_login_rate_limit_consume(text, integer, integer) from public, anon, authenticated;
grant execute on function public.flixo_admin_login_rate_limit_consume(text, integer, integer) to service_role;
revoke execute on function public.flixo_admin_login_rate_limit_reset(text) from public, anon, authenticated;
grant execute on function public.flixo_admin_login_rate_limit_reset(text) to service_role;

create or replace function public.council_heartbeat_dispatch(p_dispatch_id uuid,p_account_id text,p_session_id text,p_exact_sha text)
returns public.flix_council_dispatches
language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $function$
declare picked public.flix_council_dispatches;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then raise exception 'COUNCIL_HEARTBEAT_SESSION_REQUIRED'; end if;
  if not exists (select 1 from public.flix_council_accounts where account_id=p_account_id and active=true and current_session_id=p_session_id) then
    raise exception 'COUNCIL_SESSION_BINDING_REJECTED';
  end if;
  update public.flix_council_dispatches d
     set lease_expires_at=now()+make_interval(secs=>(select lease_seconds from public.flix_council_accounts where account_id=p_account_id)),
         session_id=p_session_id,updated_at=now()
   where d.dispatch_id=p_dispatch_id and d.recipient_account_id=p_account_id and d.entry_sha=p_exact_sha
     and d.session_id=p_session_id and d.status in ('LEASED','ACKED') and d.lease_expires_at>now()
   returning d.* into picked;
  if not found then raise exception 'COUNCIL_HEARTBEAT_REJECTED'; end if;
  update public.flix_council_accounts set current_session_id=p_session_id,last_seen_at=now(),updated_at=now() where account_id=p_account_id;
  insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
    values(p_dispatch_id,p_account_id,'HEARTBEAT',p_exact_sha,jsonb_build_object('sessionId',p_session_id));
  return picked;
end;
$function$;

create or replace function public.council_complete_dispatch(p_dispatch_id uuid,p_account_id text,p_session_id text,p_exact_sha text,p_status text,p_evidence jsonb,p_payload jsonb)
returns public.flix_council_dispatches
language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $function$
declare picked public.flix_council_dispatches; next_status text;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then raise exception 'COUNCIL_COMPLETE_SESSION_REQUIRED'; end if;
  if not exists (select 1 from public.flix_council_accounts where account_id=p_account_id and active=true and current_session_id=p_session_id) then
    raise exception 'COUNCIL_SESSION_BINDING_REJECTED';
  end if;
  if p_exact_sha is null or p_exact_sha !~ '^[0-9a-f]{40}$' then raise exception 'COUNCIL_EXACT_SHA_INVALID'; end if;
  next_status:=case when p_status='FAILED' then 'FAILED' else 'DONE' end;
  update public.flix_council_dispatches d
     set status=next_status,session_id=p_session_id,evidence=coalesce(p_evidence,'{}'::jsonb),payload=coalesce(p_payload,'{}'::jsonb),completed_at=now(),updated_at=now()
   where d.dispatch_id=p_dispatch_id and d.recipient_account_id=p_account_id and d.entry_sha=p_exact_sha
     and d.session_id=p_session_id and d.status in ('LEASED','ACKED')
   returning d.* into picked;
  if not found then raise exception 'COUNCIL_COMPLETE_REJECTED'; end if;
  insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
    values(p_dispatch_id,p_account_id,case when next_status='DONE' then 'COMPLETED' else 'FAILED' end,p_exact_sha,
      jsonb_build_object('sessionId',p_session_id,'status',next_status,'evidence',coalesce(p_evidence,'{}'::jsonb),'payload',coalesce(p_payload,'{}'::jsonb)));
  if next_status='DONE' then
    insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
      values(p_dispatch_id,picked.handoff_account_id,'HANDOFF_READY',p_exact_sha,
        jsonb_build_object('sourceAccountId',p_account_id,'sessionId',p_session_id,'taskId',picked.task_id,'workPackageId',picked.work_package_id,'evidence',coalesce(p_evidence,'{}'::jsonb),'payload',coalesce(p_payload,'{}'::jsonb)));
  end if;
  return picked;
end;
$function$;

create or replace function public.flixo_admin_canonical_jsonb(p_value jsonb)
returns text language sql immutable strict set search_path to pg_catalog, public, pg_temp
as $function$
select case jsonb_typeof(p_value)
  when 'object' then '{' || coalesce((select string_agg(to_jsonb(key)::text || ':' || public.flixo_admin_canonical_jsonb(value), ',' order by key) from jsonb_each(p_value)), '') || '}'
  when 'array' then '[' || coalesce((select string_agg(public.flixo_admin_canonical_jsonb(value), ',' order by ord) from jsonb_array_elements(p_value) with ordinality as items(value,ord)), '') || ']'
  else p_value::text
end;
$function$;

create or replace function public.flixo_admin_evidence_integrity_sha(p_evidence public.flix_admin_evidence)
returns text language sql immutable strict set search_path to pg_catalog, public, pg_temp
as $function$
select encode(extensions.digest(convert_to(public.flixo_admin_canonical_jsonb(jsonb_build_object(
  'evidence_id',p_evidence.evidence_id,'assertion_id',p_evidence.assertion_id,'claim_id',p_evidence.claim_id,'exact_sha',p_evidence.exact_sha,
  'source',p_evidence.source,'evaluator',p_evidence.evaluator,'environment',p_evidence.environment,'status',p_evidence.status,
  'freshness_at',to_char(p_evidence.freshness_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'recorded_at',to_char(p_evidence.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'payload',coalesce(p_evidence.payload,'{}'::jsonb),
  'expires_at',case when p_evidence.expires_at is null then null else to_char(p_evidence.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
  'created_at',to_char(p_evidence.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)), 'UTF8'),'sha256'),'hex');
$function$;

create or replace function public.flixo_admin_audit_integrity_sha(p_audit public.flix_admin_audit_events)
returns text language sql immutable strict set search_path to pg_catalog, public, pg_temp
as $function$
select encode(extensions.digest(convert_to(public.flixo_admin_canonical_jsonb(jsonb_build_object(
  'event_id',p_audit.event_id,'actor_subject',p_audit.actor_subject,'actor_role',p_audit.actor_role,'action',p_audit.action,
  'capability',p_audit.capability,'target_type',p_audit.target_type,'target_id',p_audit.target_id,'exact_sha',p_audit.exact_sha,
  'environment',p_audit.environment,'outcome',p_audit.outcome,'correlation_id',p_audit.correlation_id,'evidence_id',p_audit.evidence_id,
  'occurred_at',to_char(p_audit.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'metadata',coalesce(p_audit.metadata,'{}'::jsonb),'created_at',to_char(p_audit.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)), 'UTF8'),'sha256'),'hex');
$function$;

update public.flix_admin_evidence as evidence set integrity_sha256=public.flixo_admin_evidence_integrity_sha(evidence);
update public.flix_admin_audit_events as audit set integrity_sha256=public.flixo_admin_audit_integrity_sha(audit);

create or replace function public.flixo_admin_evidence_integrity_guard()
returns trigger language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $function$
begin
  if tg_op='UPDATE' then raise exception 'ADMIN_EVIDENCE_RECORD_IMMUTABLE'; end if;
  new.integrity_sha256=public.flixo_admin_evidence_integrity_sha(new);
  return new;
end;
$function$;
create or replace function public.flixo_admin_audit_integrity_guard()
returns trigger language plpgsql security definer set search_path to pg_catalog, public, pg_temp
as $function$
begin
  if tg_op='UPDATE' then raise exception 'ADMIN_AUDIT_RECORD_IMMUTABLE'; end if;
  new.integrity_sha256=public.flixo_admin_audit_integrity_sha(new);
  return new;
end;
$function$;

drop trigger if exists flixo_admin_evidence_integrity_guard on public.flix_admin_evidence;
create trigger flixo_admin_evidence_integrity_guard before insert or update on public.flix_admin_evidence
for each row execute function public.flixo_admin_evidence_integrity_guard();
drop trigger if exists flixo_admin_audit_integrity_guard on public.flix_admin_audit_events;
create trigger flixo_admin_audit_integrity_guard before insert or update on public.flix_admin_audit_events
for each row execute function public.flixo_admin_audit_integrity_guard();

revoke execute on function public.flixo_admin_canonical_jsonb(jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.flixo_admin_evidence_integrity_sha(public.flix_admin_evidence) from public, anon, authenticated, service_role;
revoke execute on function public.flixo_admin_audit_integrity_sha(public.flix_admin_audit_events) from public, anon, authenticated, service_role;
revoke execute on function public.flixo_admin_evidence_integrity_guard() from public, anon, authenticated, service_role;
revoke execute on function public.flixo_admin_audit_integrity_guard() from public, anon, authenticated, service_role;
