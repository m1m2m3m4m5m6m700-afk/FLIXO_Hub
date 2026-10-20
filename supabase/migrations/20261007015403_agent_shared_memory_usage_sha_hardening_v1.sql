-- Make harmful feedback immediately non-operational and require
-- independent, tested-SHA usage before promotion.
create or replace function public.flixo_record_agent_memory_usage(
  p_memory_id uuid, p_agent_id text, p_task_id text, p_exact_sha text, p_outcome text,
  p_evidence_refs jsonb default '[]'::jsonb, p_notes text default ''
)
returns jsonb language plpgsql as $$
declare
  v_memory public.flixo_agent_shared_memory%rowtype;
  v_key text; v_count integer; v_helpful integer; v_harmful integer; v_helpful_agents integer;
  v_utility numeric; v_status text;
begin
  perform public.flixo_require_agent_learning_service_role();
  select * into v_memory from public.flixo_agent_shared_memory where memory_id=p_memory_id for update;
  if not found then raise exception 'MEMORY_NOT_FOUND'; end if;
  if trim(p_agent_id)=trim(v_memory.source_agent)
     or trim(p_agent_id)=coalesce(v_memory.metadata->>'agent_id','') then
    raise exception 'INDEPENDENT_USAGE_REQUIRED';
  end if;
  if p_exact_sha !~ '^[0-9a-f]{40}$' then raise exception 'INVALID_USAGE_SHA'; end if;
  if p_outcome not in ('HELPFUL','HARMFUL','NEUTRAL','NOT_APPLICABLE') then raise exception 'INVALID_USAGE_OUTCOME'; end if;
  if jsonb_typeof(p_evidence_refs) <> 'array' or jsonb_array_length(p_evidence_refs)=0 then raise exception 'USAGE_EVIDENCE_REQUIRED'; end if;

  v_key := encode(digest(concat_ws('|',p_memory_id::text,trim(p_agent_id),trim(p_task_id),lower(p_exact_sha),p_outcome),'sha256'),'hex');
  insert into public.flixo_agent_shared_memory_usage(usage_key,memory_id,agent_id,task_id,exact_sha,outcome,evidence_refs,notes)
  values(v_key,p_memory_id,trim(p_agent_id),trim(p_task_id),lower(p_exact_sha),p_outcome,p_evidence_refs,trim(p_notes))
  on conflict(usage_key) do nothing;

  select count(*),
    count(*) filter(where outcome='HELPFUL' and exact_sha=v_memory.tested_sha),
    count(*) filter(where outcome='HARMFUL'),
    count(distinct agent_id) filter(where outcome='HELPFUL' and exact_sha=v_memory.tested_sha)
    into v_count,v_helpful,v_harmful,v_helpful_agents
    from public.flixo_agent_shared_memory_usage where memory_id=p_memory_id;

  v_utility := greatest(-2::numeric,least(1::numeric,(v_helpful-(2*v_harmful))::numeric/greatest(1,v_count)));
  v_status := case when p_outcome='HARMFUL' then 'DISPUTED' else v_memory.status end;

  update public.flixo_agent_shared_memory set
    usage_count=v_count,helpful_count=v_helpful,harmful_count=v_harmful,utility_score=v_utility,
    confidence=greatest(0::numeric,least(1::numeric,confidence+
      case when p_outcome='HELPFUL' and p_exact_sha=v_memory.tested_sha then 0.03
           when p_outcome='HARMFUL' then -0.12 else 0 end)),
    last_used_at=now(),status=v_status
   where memory_id=p_memory_id;

  return jsonb_build_object('memory_id',p_memory_id,'usage_count',v_count,'helpful_count',v_helpful,
    'helpful_agent_count',v_helpful_agents,'harmful_count',v_harmful,'utility_score',v_utility,'status',v_status,
    'usage_sha_freshness',case when lower(p_exact_sha)=v_memory.tested_sha then 'CURRENT_SHA' else 'STALE_EVIDENCE' end);
end;
$$;

alter function public.flixo_record_agent_memory_usage(uuid,text,text,text,text,jsonb,text)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.flixo_record_agent_memory_usage(uuid,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.flixo_record_agent_memory_usage(uuid,text,text,text,text,jsonb,text) to service_role;
