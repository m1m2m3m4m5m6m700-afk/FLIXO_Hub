-- Council source reconciliation.
-- The live Supabase project already contains these RPCs; this migration restores
-- their executable definitions to repository provenance so CI can audit the same
-- canonical Council contract that is deployed in the database.

create or replace function public.enforce_council_dispatch_priority()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $function$
declare
  requested text;
  council boolean;
begin
  requested := upper(coalesce(new.payload->>'priority',''));
  council := coalesce((new.payload->>'councilOperation')::boolean, false)
    or requested = 'P0'
    or length(trim(coalesce(new.payload->>'councilRole',''))) > 0;
  if council then new.priority := 0;
  elsif requested = 'P1' then new.priority := 1;
  elsif requested = 'P2' then new.priority := 2;
  elsif requested = 'P3' then new.priority := 3;
  elsif new.priority is null then new.priority := 3;
  end if;
  return new;
end;
$function$;

create or replace function public.council_claim_dispatch(p_account_id text)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $function$
declare
  picked public.flix_council_dispatches;
  account_active boolean;
begin
  select active into account_active
    from public.flix_council_accounts
   where account_id = p_account_id;
  if coalesce(account_active, false) = false then
    raise exception 'COUNCIL_ACCOUNT_INACTIVE';
  end if;

  update public.flix_council_dispatches
     set status = 'EXPIRED', updated_at = now()
   where status in ('LEASED','ACKED')
     and lease_expires_at is not null
     and lease_expires_at < now();

  select *
    into picked
    from public.flix_council_dispatches
   where (
     (status in ('LEASED','ACKED') and recipient_account_id = p_account_id and lease_expires_at > now())
     or
     (status = 'EXPIRED' and fallback_account_id = p_account_id)
   )
   order by priority asc, created_at asc
   for update skip locked
   limit 1;

  if not found then
    return;
  end if;

  if picked.status = 'EXPIRED' then
    update public.flix_council_dispatches
       set status = 'LEASED',
           recipient_account_id = p_account_id,
           lease_expires_at = now() + make_interval(secs => (
             select lease_seconds
               from public.flix_council_accounts
              where account_id = p_account_id
           )),
           attempts = attempts + 1,
           updated_at = now(),
           last_error = null
     where dispatch_id = picked.dispatch_id
     returning * into picked;

    insert into public.flix_council_events(dispatch_id, account_id, event_type, exact_sha, payload)
    values (
      picked.dispatch_id, p_account_id, 'DISPATCHED', picked.entry_sha,
      jsonb_build_object('attempt', picked.attempts, 'fallback', true, 'priority', picked.priority)
    );
  end if;

  return next picked;
end;
$function$;

create or replace function public.council_ack_dispatch(
  p_dispatch_id uuid,p_account_id text,p_session_id text,p_exact_sha text
)
returns public.flix_council_dispatches
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $function$
declare
  picked public.flix_council_dispatches;
begin
  if not exists (
    select 1 from public.flix_council_accounts
     where account_id=p_account_id and active=true
  ) then
    raise exception 'COUNCIL_ACCOUNT_INACTIVE';
  end if;
  if p_session_id is null or length(trim(p_session_id))=0 then
    raise exception 'COUNCIL_ACK_SESSION_REQUIRED';
  end if;

  update public.flix_council_dispatches
     set status='ACKED',
         session_id=p_session_id,
         acked_at=coalesce(acked_at,now()),
         updated_at=now()
   where dispatch_id=p_dispatch_id
     and recipient_account_id=p_account_id
     and entry_sha=p_exact_sha
     and status='LEASED'
     and lease_expires_at>now()
   returning * into picked;

  if not found then raise exception 'COUNCIL_ACK_REJECTED'; end if;

  update public.flix_council_accounts
     set current_session_id=p_session_id,last_seen_at=now(),updated_at=now()
   where account_id=p_account_id;

  insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
  values (p_dispatch_id,p_account_id,'ACKED',p_exact_sha,
          jsonb_build_object('sessionId',p_session_id));
  return picked;
end;
$function$;

create or replace function public.council_heartbeat_dispatch(
  p_dispatch_id uuid,p_account_id text,p_session_id text,p_exact_sha text
)
returns public.flix_council_dispatches
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $function$
declare
  picked public.flix_council_dispatches;
begin
  if not exists (
    select 1 from public.flix_council_accounts
     where account_id=p_account_id and active=true
  ) then
    raise exception 'COUNCIL_ACCOUNT_INACTIVE';
  end if;
  if p_session_id is null or length(trim(p_session_id))=0 then
    raise exception 'COUNCIL_HEARTBEAT_SESSION_REQUIRED';
  end if;

  update public.flix_council_dispatches d
     set lease_expires_at=now()+make_interval(secs=>(
       select lease_seconds from public.flix_council_accounts where account_id=p_account_id
     )),
         session_id=p_session_id,updated_at=now()
   where d.dispatch_id=p_dispatch_id
     and d.recipient_account_id=p_account_id
     and d.entry_sha=p_exact_sha
     and d.status in ('LEASED','ACKED')
     and d.lease_expires_at>now()
   returning d.* into picked;

  if not found then raise exception 'COUNCIL_HEARTBEAT_REJECTED'; end if;

  update public.flix_council_accounts
     set current_session_id=p_session_id,last_seen_at=now(),updated_at=now()
   where account_id=p_account_id;

  insert into public.flix_council_events(dispatch_id,account_id,event_type,exact_sha,payload)
  values (p_dispatch_id,p_account_id,'HEARTBEAT',p_exact_sha,
          jsonb_build_object('sessionId',p_session_id));
  return picked;
end;
$function$;

create or replace function public.council_complete_dispatch(
  p_dispatch_id uuid,p_account_id text,p_session_id text,p_exact_sha text,
  p_status text,p_evidence jsonb,p_payload jsonb
)
returns public.flix_council_dispatches
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $function$
declare
  picked public.flix_council_dispatches;
  next_status text;
begin
  if not exists (
    select 1 from public.flix_council_accounts
     where account_id=p_account_id and active=true
  ) then
    raise exception 'COUNCIL_ACCOUNT_INACTIVE';
  end if;
  if p_session_id is null or length(trim(p_session_id))=0 then
    raise exception 'COUNCIL_COMPLETE_SESSION_REQUIRED';
  end if;
  if p_exact_sha is null or p_exact_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'COUNCIL_EXACT_SHA_INVALID';
  end if;

  next_status:=case when p_status='FAILED' then 'FAILED' else 'DONE' end;

  update public.flix_council_dispatches d
     set status=next_status,
         session_id=p_session_id,
         evidence=coalesce(p_evidence,'{}'::jsonb),
         payload=coalesce(p_payload,'{}'::jsonb),
         completed_at=now(),updated_at=now()
   where d.dispatch_id=p_dispatch_id
     and d.recipient_account_id=p_account_id
     and d.entry_sha=p_exact_sha
     and d.status in ('LEASED','ACKED')
   returning d.* into picked;

  if not found then raise exception 'COUNCIL_COMPLETE_REJECTED'; end if;

  insert into public.flix_council_events(
    dispatch_id,account_id,event_type,exact_sha,payload
  )
  values (
    p_dispatch_id,p_account_id,
    case when next_status='DONE' then 'COMPLETED' else 'FAILED' end,
    p_exact_sha,
    jsonb_build_object(
      'sessionId',p_session_id,'status',next_status,
      'evidence',coalesce(p_evidence,'{}'::jsonb),
      'payload',coalesce(p_payload,'{}'::jsonb)
    )
  );

  if next_status='DONE' then
    insert into public.flix_council_events(
      dispatch_id,account_id,event_type,exact_sha,payload
    )
    values (
      p_dispatch_id,picked.handoff_account_id,'HANDOFF_READY',p_exact_sha,
      jsonb_build_object(
        'sourceAccountId',p_account_id,'sessionId',p_session_id,
        'taskId',picked.task_id,'workPackageId',picked.work_package_id,
        'evidence',coalesce(p_evidence,'{}'::jsonb),
        'payload',coalesce(p_payload,'{}'::jsonb)
      )
    );
  end if;

  return picked;
end;
$function$;

create or replace function public.council_recover_expired_dispatches(p_limit integer default 10)
returns setof public.flix_council_dispatches
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $function$
declare
  picked public.flix_council_dispatches;
  exhausted public.flix_council_dispatches;
begin
  for exhausted in
    update public.flix_council_dispatches d
       set status='EXPIRED',
           session_id=null,
           lease_expires_at=null,
           last_error='LEASE_RECOVERY_ATTEMPTS_EXHAUSTED_REQUIRES_REDISPATCH',
           updated_at=now()
     where d.status in ('LEASED','ACKED')
       and d.lease_expires_at is not null
       and d.lease_expires_at<now()
       and d.attempts>=2
     returning d.*
  loop
    insert into public.flix_council_events(
      dispatch_id,account_id,event_type,exact_sha,payload
    )
    values (
      exhausted.dispatch_id,
      coalesce(exhausted.recipient_account_id,exhausted.fallback_account_id,exhausted.primary_account_id),
      'EXPIRED',
      exhausted.entry_sha,
      jsonb_build_object(
        'reason','LEASE_RECOVERY_ATTEMPTS_EXHAUSTED_REQUIRES_REDISPATCH',
        'attempts',exhausted.attempts,'terminalLeaseState',true,
        'logicalFailure',false,'recoveryVersion','lease-watchdog-v4'
      )
    );
    if exhausted.handoff_account_id is not null then
      insert into public.flix_council_events(
        dispatch_id,account_id,event_type,exact_sha,payload
      )
      values (
        exhausted.dispatch_id,exhausted.handoff_account_id,'HANDOFF_READY',
        exhausted.entry_sha,
        jsonb_build_object(
          'reason','LEASE_RECOVERY_ATTEMPTS_EXHAUSTED_REQUIRES_REDISPATCH',
          'attempts',exhausted.attempts,'terminal',true,
          'requiredAction','SUPERVISOR_ESCALATION','recoveryVersion','lease-watchdog-v4'
        )
      );
    end if;
    return next exhausted;
  end loop;

  update public.flix_council_dispatches
     set status='EXPIRED',updated_at=now()
   where status in ('LEASED','ACKED')
     and lease_expires_at is not null
     and lease_expires_at<now()
     and attempts<2;

  for picked in
    select d.*
      from public.flix_council_dispatches d
      join public.flix_council_accounts a on a.account_id=d.fallback_account_id
     where d.status='EXPIRED'
       and d.attempts<2
       and a.active=true
     order by d.priority asc,d.updated_at asc
     for update of d skip locked
     limit greatest(1,least(25,p_limit))
  loop
    update public.flix_council_dispatches d
       set status='LEASED',
           recipient_account_id=d.fallback_account_id,
           lease_expires_at=now()+make_interval(secs=>(
             select lease_seconds from public.flix_council_accounts
              where account_id=d.fallback_account_id
           )),
           attempts=d.attempts+1,
           last_error=null,
           updated_at=now()
     where d.dispatch_id=picked.dispatch_id
     returning d.* into picked;

    insert into public.flix_council_events(
      dispatch_id,account_id,event_type,exact_sha,payload
    )
    values (
      picked.dispatch_id,picked.recipient_account_id,'DISPATCHED',picked.entry_sha,
      jsonb_build_object(
        'attempt',picked.attempts,'fallback',true,'automatic',true,
        'priority',picked.priority,'recoveryVersion','lease-watchdog-v4'
      )
    );
    return next picked;
  end loop;
end;
$function$;

alter function public.enforce_council_dispatch_priority() set search_path = pg_catalog, public, pg_temp;
alter function public.council_claim_dispatch(text) set search_path = pg_catalog, public, pg_temp;
alter function public.council_ack_dispatch(uuid, text, text, text) set search_path = pg_catalog, public, pg_temp;
alter function public.council_heartbeat_dispatch(uuid, text, text, text) set search_path = pg_catalog, public, pg_temp;
alter function public.council_complete_dispatch(uuid, text, text, text, text, jsonb, jsonb) set search_path = pg_catalog, public, pg_temp;
alter function public.council_recover_expired_dispatches(integer) set search_path = pg_catalog, public, pg_temp;

revoke execute on function public.enforce_council_dispatch_priority() from public, anon, authenticated;
grant execute on function public.enforce_council_dispatch_priority() to service_role;
revoke execute on function public.council_claim_dispatch(text) from public, anon, authenticated;
grant execute on function public.council_claim_dispatch(text) to service_role;
revoke execute on function public.council_ack_dispatch(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.council_ack_dispatch(uuid, text, text, text) to service_role;
revoke execute on function public.council_heartbeat_dispatch(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.council_heartbeat_dispatch(uuid, text, text, text) to service_role;
revoke execute on function public.council_complete_dispatch(uuid, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.council_complete_dispatch(uuid, text, text, text, text, jsonb, jsonb) to service_role;
revoke execute on function public.council_recover_expired_dispatches(integer) from public, anon, authenticated;
grant execute on function public.council_recover_expired_dispatches(integer) to service_role;
