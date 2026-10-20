-- Harmonize live shared-memory promotion with the fail-closed learning contract.
create or replace function public.flixo_reconcile_agent_memory(p_memory_id uuid, p_current_sha text)
returns jsonb
language plpgsql
as $$
declare
  v_memory public.flixo_agent_shared_memory%rowtype;
  v_confirmed integer;
  v_rejected integer;
  v_regression boolean;
  v_status text;
  v_confidence numeric;
begin
  perform public.flixo_require_agent_learning_service_role();
  if p_current_sha !~ '^[0-9a-f]{40}$' then raise exception 'INVALID_CURRENT_SHA'; end if;

  select * into v_memory
    from public.flixo_agent_shared_memory
   where memory_id=p_memory_id
   for update;
  if not found then raise exception 'MEMORY_NOT_FOUND'; end if;

  if lower(p_current_sha)<>v_memory.tested_sha then
    update public.flixo_agent_shared_memory
       set status='STALE_EVIDENCE'
     where memory_id=p_memory_id;
    return jsonb_build_object(
      'memory_id',p_memory_id,
      'status','STALE_EVIDENCE',
      'tested_sha',v_memory.tested_sha,
      'current_sha',lower(p_current_sha)
    );
  end if;

  select
    count(*) filter(where decision='CONFIRMED' and reviewed_sha=v_memory.tested_sha),
    count(*) filter(where decision='REJECTED'),
    coalesce(bool_or(regression_confirmed and reviewed_sha=v_memory.tested_sha),false)
    into v_confirmed,v_rejected,v_regression
    from public.flixo_agent_shared_memory_reviews
   where memory_id=p_memory_id;

  if v_rejected>0 then
    v_status:='DISPUTED';
  elsif v_confirmed>=2
        and v_memory.helpful_count>=2
        and v_memory.harmful_count=0
        and v_regression then
    v_status:='PROMOTED';
  elsif v_confirmed>=1 and v_memory.harmful_count=0 then
    v_status:='VALIDATED';
  else
    v_status:='CANDIDATE';
  end if;

  v_confidence:=greatest(0::numeric,least(1::numeric,
    0.40+(0.15*v_confirmed)+(0.04*v_memory.helpful_count)
    -(0.15*v_rejected)-(0.12*v_memory.harmful_count)));

  update public.flixo_agent_shared_memory
     set status=v_status,
         independent_confirmations=v_confirmed,
         contradiction_count=v_rejected,
         regression_evidence=v_regression,
         confidence=v_confidence,
         last_validated_at=case
           when v_status in ('VALIDATED','PROMOTED') then now()
           else last_validated_at
         end
   where memory_id=p_memory_id;

  if v_status='PROMOTED' then
    update public.flixo_agent_learning_events
       set status='VERIFIED'
     where learning_id=v_memory.source_learning_id;
  end if;

  return jsonb_build_object(
    'memory_id',p_memory_id,
    'status',v_status,
    'confidence',v_confidence,
    'independent_confirmations',v_confirmed,
    'helpful_count',v_memory.helpful_count,
    'harmful_count',v_memory.harmful_count,
    'regression_evidence',v_regression,
    'tested_sha',v_memory.tested_sha
  );
end;
$$;

revoke all on function public.flixo_reconcile_agent_memory(uuid,text) from public,anon,authenticated;
grant execute on function public.flixo_reconcile_agent_memory(uuid,text) to service_role;
