-- Require canonical agent identity metadata so the source cannot self-report
-- independent usage under a different display name.
create or replace function public.flixo_submit_agent_memory(
  p_agent text, p_role text, p_task_id text, p_exact_sha text, p_kind text, p_knowledge_key text,
  p_title text, p_claim text, p_content text, p_scope jsonb default '{}'::jsonb,
  p_evidence_refs jsonb default '[]'::jsonb, p_provenance jsonb default '{}'::jsonb, p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_learning_id uuid;
  v_memory_id uuid;
  v_revision integer;
  v_hash text;
  v_previous uuid;
  v_shared_kind text;
  v_ledger_kind text;
  v_provenance jsonb;
  v_agent_id text;
  v_metadata jsonb;
begin
  perform public.flixo_require_agent_learning_service_role();
  if p_exact_sha !~ '^[0-9a-f]{40}$' then raise exception 'INVALID_EXACT_SHA'; end if;
  if p_knowledge_key !~ '^[a-z0-9][a-z0-9._:-]{2,255}$' then raise exception 'INVALID_KNOWLEDGE_KEY'; end if;
  if upper(trim(p_kind)) not in ('LESSON','ANTI_LESSON','HEURISTIC','PATTERN','WARNING','FACT') then raise exception 'INVALID_MEMORY_KIND'; end if;
  if jsonb_typeof(p_evidence_refs) <> 'array' or jsonb_array_length(p_evidence_refs)=0 then raise exception 'INVALID_EVIDENCE_REFS'; end if;
  if jsonb_typeof(p_metadata) <> 'object' then raise exception 'INVALID_METADATA'; end if;

  v_agent_id := coalesce(p_metadata->>'agent_id',
    case when p_agent ~ '^(AGENT-[0-9]{2}|SUPPORT-EXPLORER-[0-9]{2})$' then p_agent else null end);
  if v_agent_id is null or v_agent_id !~ '^(AGENT-[0-9]{2}|SUPPORT-EXPLORER-[0-9]{2})$' then
    raise exception 'AGENT_ID_REQUIRED';
  end if;

  v_shared_kind := upper(trim(p_kind));
  v_ledger_kind := case
    when v_shared_kind='LESSON' then 'LESSON'
    when v_shared_kind='ANTI_LESSON' then 'ANTI_LESSON'
    else 'ADVICE'
  end;
  v_provenance := coalesce(p_provenance,'{}'::jsonb) || jsonb_build_object('shared_memory_kind',v_shared_kind);
  v_metadata := p_metadata || jsonb_build_object('agent_id',v_agent_id);

  perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_knowledge_key)),0));
  v_hash := encode(digest(concat_ws('|',lower(trim(p_knowledge_key)),lower(trim(p_agent)),v_shared_kind,
    trim(p_title),trim(p_claim),trim(p_content),lower(p_exact_sha)),'sha256'),'hex');

  select revision,memory_id into v_revision,v_previous
    from public.flixo_agent_shared_memory
   where knowledge_key=lower(trim(p_knowledge_key))
   order by revision desc limit 1;
  v_revision := coalesce(v_revision,0)+1;

  insert into public.flixo_agent_learning_events(
    source_agent,source_role,kind,status,task_id,target_sha,claim,content,evidence_refs,provenance,fingerprint,canonical_green
  ) values(
    trim(p_agent),trim(p_role),v_ledger_kind,'PROPOSED',trim(p_task_id),lower(p_exact_sha),trim(p_claim),trim(p_content),
    p_evidence_refs,v_provenance,v_hash,false
  ) returning learning_id into v_learning_id;

  insert into public.flixo_agent_shared_memory(
    knowledge_key,revision,source_learning_id,source_agent,source_role,kind,title,claim,content,scope,status,tested_sha,
    evidence_count,previous_memory_id,content_hash,metadata
  ) values(
    lower(trim(p_knowledge_key)),v_revision,v_learning_id,trim(p_agent),trim(p_role),v_shared_kind,trim(p_title),trim(p_claim),
    trim(p_content),coalesce(p_scope,'{}'::jsonb),'CANDIDATE',lower(p_exact_sha),jsonb_array_length(p_evidence_refs),
    v_previous,v_hash,v_metadata
  ) returning memory_id into v_memory_id;

  return jsonb_build_object('learning_id',v_learning_id,'memory_id',v_memory_id,'knowledge_key',lower(trim(p_knowledge_key)),
    'revision',v_revision,'status','CANDIDATE','tested_sha',lower(p_exact_sha),'kind',v_shared_kind,'agent_id',v_agent_id);
end;
$$;

alter function public.flixo_submit_agent_memory(text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb)
  set search_path = pg_catalog, public, extensions;
revoke all on function public.flixo_submit_agent_memory(text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.flixo_submit_agent_memory(text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb)
  to service_role;
