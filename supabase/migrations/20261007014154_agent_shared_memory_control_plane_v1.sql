create extension if not exists vector;

create table if not exists public.flixo_agent_shared_memory (
  memory_id uuid primary key default gen_random_uuid(),
  knowledge_key text not null,
  revision integer not null default 1 check (revision >= 1),
  source_learning_id uuid references public.flixo_agent_learning_events(learning_id) on delete set null,
  source_agent text not null check (char_length(trim(source_agent)) between 1 and 120),
  source_role text not null check (char_length(trim(source_role)) between 1 and 120),
  kind text not null check (kind in ('LESSON','ANTI_LESSON','HEURISTIC','PATTERN','WARNING','FACT')),
  title text not null check (char_length(trim(title)) between 3 and 300),
  claim text not null check (char_length(trim(claim)) between 10 and 2000),
  content text not null check (char_length(trim(content)) between 10 and 12000),
  scope jsonb not null default '{}'::jsonb check (jsonb_typeof(scope)='object'),
  status text not null default 'CANDIDATE' check (status in ('CANDIDATE','VALIDATED','PROMOTED','DISPUTED','STALE_EVIDENCE','REVOKED','SUPERSEDED')),
  tested_sha text not null check (tested_sha ~ '^[0-9a-f]{40}$'),
  confidence numeric(5,4) not null default 0.5000 check (confidence between 0 and 1),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  independent_confirmations integer not null default 0 check (independent_confirmations >= 0),
  contradiction_count integer not null default 0 check (contradiction_count >= 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  helpful_count integer not null default 0 check (helpful_count >= 0),
  harmful_count integer not null default 0 check (harmful_count >= 0),
  regression_evidence boolean not null default false,
  utility_score numeric(7,4) not null default 0 check (utility_score >= -2 and utility_score <= 1),
  previous_memory_id uuid references public.flixo_agent_shared_memory(memory_id),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  embedding vector(384),
  search_document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(claim,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(content,'')), 'C')
  ) stored,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  last_validated_at timestamptz,
  last_used_at timestamptz,
  unique (knowledge_key, revision),
  unique (content_hash)
);

create index if not exists flixo_agent_shared_memory_search_idx on public.flixo_agent_shared_memory using gin (search_document);
create index if not exists flixo_agent_shared_memory_embedding_idx on public.flixo_agent_shared_memory using hnsw (embedding vector_cosine_ops);
create index if not exists flixo_agent_shared_memory_status_idx on public.flixo_agent_shared_memory (status, tested_sha, last_validated_at desc);
create index if not exists flixo_agent_shared_memory_key_idx on public.flixo_agent_shared_memory (knowledge_key, revision desc);

create table if not exists public.flixo_agent_shared_memory_reviews (
  review_id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.flixo_agent_shared_memory(memory_id) on delete cascade,
  reviewer_agent text not null check (char_length(trim(reviewer_agent)) between 1 and 120),
  decision text not null check (decision in ('CONFIRMED','REJECTED','DISPUTED','UNKNOWN')),
  reviewed_sha text not null check (reviewed_sha ~ '^[0-9a-f]{40}$'),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  regression_confirmed boolean not null default false,
  rationale text not null check (char_length(trim(rationale)) between 3 and 6000),
  created_at timestamptz not null default now(),
  unique (memory_id, reviewer_agent)
);

create index if not exists flixo_agent_shared_memory_reviews_idx on public.flixo_agent_shared_memory_reviews (memory_id, decision, reviewed_sha);

create table if not exists public.flixo_agent_shared_memory_usage (
  usage_id uuid primary key default gen_random_uuid(),
  usage_key text not null unique,
  memory_id uuid not null references public.flixo_agent_shared_memory(memory_id) on delete cascade,
  agent_id text not null check (char_length(trim(agent_id)) between 1 and 120),
  task_id text not null check (char_length(trim(task_id)) between 1 and 256),
  exact_sha text not null check (exact_sha ~ '^[0-9a-f]{40}$'),
  outcome text not null check (outcome in ('HELPFUL','HARMFUL','NEUTRAL','NOT_APPLICABLE')),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  notes text not null default '' check (char_length(notes) <= 6000),
  created_at timestamptz not null default now()
);

create index if not exists flixo_agent_shared_memory_usage_idx on public.flixo_agent_shared_memory_usage (memory_id, outcome, exact_sha);

alter table public.flixo_agent_shared_memory enable row level security;
alter table public.flixo_agent_shared_memory_reviews enable row level security;
alter table public.flixo_agent_shared_memory_usage enable row level security;

drop policy if exists flixo_agent_shared_memory_service_only on public.flixo_agent_shared_memory;
create policy flixo_agent_shared_memory_service_only on public.flixo_agent_shared_memory for all to service_role using (true) with check (true);
drop policy if exists flixo_agent_shared_memory_reviews_service_only on public.flixo_agent_shared_memory_reviews;
create policy flixo_agent_shared_memory_reviews_service_only on public.flixo_agent_shared_memory_reviews for all to service_role using (true) with check (true);
drop policy if exists flixo_agent_shared_memory_usage_service_only on public.flixo_agent_shared_memory_usage;
create policy flixo_agent_shared_memory_usage_service_only on public.flixo_agent_shared_memory_usage for all to service_role using (true) with check (true);

revoke all on public.flixo_agent_shared_memory from anon, authenticated;
revoke all on public.flixo_agent_shared_memory_reviews from anon, authenticated;
revoke all on public.flixo_agent_shared_memory_usage from anon, authenticated;
grant select, insert, update on public.flixo_agent_shared_memory to service_role;
grant select, insert, update on public.flixo_agent_shared_memory_reviews to service_role;
grant select, insert on public.flixo_agent_shared_memory_usage to service_role;

create or replace function public.flixo_require_agent_learning_service_role()
returns void language plpgsql as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'AGENT_LEARNING_SERVICE_ROLE_REQUIRED';
  end if;
end;
$$;

create or replace function public.flixo_submit_agent_memory(
  p_agent text, p_role text, p_task_id text, p_exact_sha text, p_kind text, p_knowledge_key text,
  p_title text, p_claim text, p_content text, p_scope jsonb default '{}'::jsonb,
  p_evidence_refs jsonb default '[]'::jsonb, p_provenance jsonb default '{}'::jsonb, p_metadata jsonb default '{}'::jsonb
)
returns jsonb language plpgsql as $$
declare
  v_learning_id uuid; v_memory_id uuid; v_revision integer; v_hash text; v_previous uuid;
begin
  perform public.flixo_require_agent_learning_service_role();
  if p_exact_sha !~ '^[0-9a-f]{40}$' then raise exception 'INVALID_EXACT_SHA'; end if;
  if p_knowledge_key !~ '^[a-z0-9][a-z0-9._:-]{2,255}$' then raise exception 'INVALID_KNOWLEDGE_KEY'; end if;
  if jsonb_typeof(p_evidence_refs) <> 'array' then raise exception 'INVALID_EVIDENCE_REFS'; end if;

  v_hash := encode(digest(concat_ws('|', lower(trim(p_knowledge_key)), lower(trim(p_agent)), lower(trim(p_kind)),
    trim(p_title), trim(p_claim), trim(p_content), lower(p_exact_sha)), 'sha256'), 'hex');

  select max(revision), max(memory_id) into v_revision, v_previous
    from public.flixo_agent_shared_memory
   where knowledge_key=lower(trim(p_knowledge_key));
  v_revision := coalesce(v_revision,0)+1;

  insert into public.flixo_agent_learning_events(
    source_agent, source_role, kind, status, task_id, target_sha, claim, content, evidence_refs, provenance, fingerprint, canonical_green
  ) values (
    trim(p_agent), trim(p_role), upper(trim(p_kind)), 'PROPOSED', trim(p_task_id), lower(p_exact_sha),
    trim(p_claim), trim(p_content), p_evidence_refs, p_provenance, v_hash, false
  ) returning learning_id into v_learning_id;

  if v_previous is not null then
    update public.flixo_agent_shared_memory set status='SUPERSEDED' where memory_id=v_previous;
  end if;

  insert into public.flixo_agent_shared_memory(
    knowledge_key, revision, source_learning_id, source_agent, source_role, kind, title, claim, content, scope, status, tested_sha,
    evidence_count, previous_memory_id, content_hash, metadata
  ) values (
    lower(trim(p_knowledge_key)), v_revision, v_learning_id, trim(p_agent), trim(p_role), upper(trim(p_kind)),
    trim(p_title), trim(p_claim), trim(p_content), coalesce(p_scope,'{}'::jsonb), 'CANDIDATE', lower(p_exact_sha),
    jsonb_array_length(p_evidence_refs), v_previous, v_hash, coalesce(p_metadata,'{}'::jsonb)
  ) returning memory_id into v_memory_id;

  return jsonb_build_object('learning_id',v_learning_id,'memory_id',v_memory_id,'knowledge_key',lower(trim(p_knowledge_key)),
    'revision',v_revision,'status','CANDIDATE','tested_sha',lower(p_exact_sha));
end;
$$;

create or replace function public.flixo_review_agent_memory(
  p_memory_id uuid, p_reviewer_agent text, p_decision text, p_reviewed_sha text,
  p_evidence_refs jsonb default '[]'::jsonb, p_regression_confirmed boolean default false, p_rationale text default ''
)
returns jsonb language plpgsql as $$
declare
  v_memory public.flixo_agent_shared_memory%rowtype;
  v_confirmed integer; v_rejected integer; v_regression boolean; v_status text;
begin
  perform public.flixo_require_agent_learning_service_role();
  select * into v_memory from public.flixo_agent_shared_memory where memory_id=p_memory_id for update;
  if not found then raise exception 'MEMORY_NOT_FOUND'; end if;
  if trim(p_reviewer_agent)=trim(v_memory.source_agent) then raise exception 'INDEPENDENT_REVIEW_REQUIRED'; end if;
  if p_reviewed_sha !~ '^[0-9a-f]{40}$' then raise exception 'INVALID_REVIEW_SHA'; end if;
  if p_decision not in ('CONFIRMED','REJECTED','DISPUTED','UNKNOWN') then raise exception 'INVALID_DECISION'; end if;

  insert into public.flixo_agent_shared_memory_reviews(memory_id,reviewer_agent,decision,reviewed_sha,evidence_refs,regression_confirmed,rationale)
  values(p_memory_id,trim(p_reviewer_agent),p_decision,lower(p_reviewed_sha),p_evidence_refs,p_regression_confirmed,trim(p_rationale))
  on conflict(memory_id,reviewer_agent) do update set
    decision=excluded.decision, reviewed_sha=excluded.reviewed_sha, evidence_refs=excluded.evidence_refs,
    regression_confirmed=excluded.regression_confirmed, rationale=excluded.rationale;

  select count(*) filter(where decision='CONFIRMED' and reviewed_sha=v_memory.tested_sha),
         count(*) filter(where decision='REJECTED'),
         coalesce(bool_or(regression_confirmed and reviewed_sha=v_memory.tested_sha),false)
    into v_confirmed,v_rejected,v_regression
    from public.flixo_agent_shared_memory_reviews where memory_id=p_memory_id;

  if v_rejected > 0 then v_status := 'DISPUTED';
  elsif v_confirmed >= 1 then v_status := 'VALIDATED';
  else v_status := 'CANDIDATE';
  end if;

  update public.flixo_agent_shared_memory set
    independent_confirmations=v_confirmed, regression_evidence=v_regression, status=v_status,
    last_validated_at=case when p_reviewed_sha=v_memory.tested_sha then now() else last_validated_at end
    where memory_id=p_memory_id;

  return jsonb_build_object('memory_id',p_memory_id,'status',v_status,'independent_confirmations',v_confirmed,'regression_evidence',v_regression);
end;
$$;

create or replace function public.flixo_record_agent_memory_usage(
  p_memory_id uuid, p_agent_id text, p_task_id text, p_exact_sha text, p_outcome text,
  p_evidence_refs jsonb default '[]'::jsonb, p_notes text default ''
)
returns jsonb language plpgsql as $$
declare
  v_memory public.flixo_agent_shared_memory%rowtype;
  v_key text; v_count integer; v_helpful integer; v_harmful integer; v_utility numeric;
begin
  perform public.flixo_require_agent_learning_service_role();
  select * into v_memory from public.flixo_agent_shared_memory where memory_id=p_memory_id;
  if not found then raise exception 'MEMORY_NOT_FOUND'; end if;
  if p_exact_sha !~ '^[0-9a-f]{40}$' then raise exception 'INVALID_USAGE_SHA'; end if;
  if p_outcome not in ('HELPFUL','HARMFUL','NEUTRAL','NOT_APPLICABLE') then raise exception 'INVALID_USAGE_OUTCOME'; end if;

  v_key := encode(digest(concat_ws('|',p_memory_id::text,trim(p_agent_id),trim(p_task_id),lower(p_exact_sha),p_outcome),'sha256'),'hex');

  insert into public.flixo_agent_shared_memory_usage(usage_key,memory_id,agent_id,task_id,exact_sha,outcome,evidence_refs,notes)
  values(v_key,p_memory_id,trim(p_agent_id),trim(p_task_id),lower(p_exact_sha),p_outcome,p_evidence_refs,trim(p_notes))
  on conflict(usage_key) do nothing;

  select count(*),count(*) filter(where outcome='HELPFUL'),count(*) filter(where outcome='HARMFUL')
    into v_count,v_helpful,v_harmful
    from public.flixo_agent_shared_memory_usage where memory_id=p_memory_id;

  v_utility := greatest(-2::numeric, least(1::numeric,(v_helpful-(2*v_harmful))::numeric/greatest(1,v_count)));

  update public.flixo_agent_shared_memory set
    usage_count=v_count, helpful_count=v_helpful, harmful_count=v_harmful, utility_score=v_utility,
    confidence=greatest(0::numeric,least(1::numeric,confidence+
      case when p_outcome='HELPFUL' then 0.03 when p_outcome='HARMFUL' then -0.08 else 0 end)),
    last_used_at=now()
    where memory_id=p_memory_id;

  return jsonb_build_object('memory_id',p_memory_id,'usage_count',v_count,'helpful_count',v_helpful,'harmful_count',v_harmful,'utility_score',v_utility);
end;
$$;

create or replace function public.flixo_reconcile_agent_memory(p_memory_id uuid, p_current_sha text)
returns jsonb language plpgsql as $$
declare
  v_memory public.flixo_agent_shared_memory%rowtype;
  v_confirmed integer; v_rejected integer; v_regression boolean; v_status text; v_confidence numeric;
begin
  perform public.flixo_require_agent_learning_service_role();
  if p_current_sha !~ '^[0-9a-f]{40}$' then raise exception 'INVALID_CURRENT_SHA'; end if;

  select * into v_memory from public.flixo_agent_shared_memory where memory_id=p_memory_id for update;
  if not found then raise exception 'MEMORY_NOT_FOUND'; end if;

  if lower(p_current_sha)<>v_memory.tested_sha then
    update public.flixo_agent_shared_memory set status='STALE_EVIDENCE' where memory_id=p_memory_id;
    return jsonb_build_object('memory_id',p_memory_id,'status','STALE_EVIDENCE','tested_sha',v_memory.tested_sha,'current_sha',lower(p_current_sha));
  end if;

  select count(*) filter(where decision='CONFIRMED' and reviewed_sha=v_memory.tested_sha),
         count(*) filter(where decision='REJECTED'),
         coalesce(bool_or(regression_confirmed and reviewed_sha=v_memory.tested_sha),false)
    into v_confirmed,v_rejected,v_regression
    from public.flixo_agent_shared_memory_reviews where memory_id=p_memory_id;

  if v_rejected>0 then v_status:='DISPUTED';
  elsif v_confirmed>=2 and v_memory.helpful_count>=2 and v_regression then v_status:='PROMOTED';
  elsif v_confirmed>=1 then v_status:='VALIDATED';
  else v_status:='CANDIDATE';
  end if;

  v_confidence:=greatest(0::numeric,least(1::numeric,
    0.40+(0.15*v_confirmed)+(0.04*v_memory.helpful_count)-(0.15*v_rejected)-(0.10*v_memory.harmful_count)));

  update public.flixo_agent_shared_memory set
    status=v_status, independent_confirmations=v_confirmed, contradiction_count=v_rejected,
    regression_evidence=v_regression, confidence=v_confidence,
    last_validated_at=case when v_status in ('VALIDATED','PROMOTED') then now() else last_validated_at end
    where memory_id=p_memory_id;

  if v_status='PROMOTED' then
    update public.flixo_agent_learning_events set status='VERIFIED' where learning_id=v_memory.source_learning_id;
  end if;

  return jsonb_build_object('memory_id',p_memory_id,'status',v_status,'confidence',v_confidence,
    'independent_confirmations',v_confirmed,'helpful_count',v_memory.helpful_count,'harmful_count',v_memory.harmful_count,
    'regression_evidence',v_regression,'tested_sha',v_memory.tested_sha);
end;
$$;

create or replace function public.flixo_search_agent_memory(
  p_query text, p_current_sha text, p_limit integer default 8, p_include_candidates boolean default false
)
returns table(
  memory_id uuid, knowledge_key text, revision integer, source_agent text, source_role text, kind text, title text,
  claim text, content text, status text, confidence numeric, utility_score numeric, tested_sha text, sha_freshness text,
  usable boolean, evidence_count integer, independent_confirmations integer, usage_count integer, helpful_count integer,
  harmful_count integer, rank_score real
)
language sql stable as $$
  select m.memory_id,m.knowledge_key,m.revision,m.source_agent,m.source_role,m.kind,m.title,m.claim,m.content,m.status,
    m.confidence,m.utility_score,m.tested_sha,
    case when m.tested_sha=lower(p_current_sha) then 'CURRENT_SHA' else 'STALE_EVIDENCE' end,
    (m.status='PROMOTED' and m.tested_sha=lower(p_current_sha)),
    m.evidence_count,m.independent_confirmations,m.usage_count,m.helpful_count,m.harmful_count,
    case when nullif(trim(p_query),'') is null then 0 else
      ts_rank_cd(m.search_document, websearch_to_tsquery('simple',trim(p_query))) end
  from public.flixo_agent_shared_memory m
  where m.status not in ('REVOKED','SUPERSEDED')
    and (p_include_candidates or m.status in ('VALIDATED','PROMOTED'))
    and (nullif(trim(p_query),'') is null or
      m.search_document @@ websearch_to_tsquery('simple',trim(p_query)) or
      m.title ilike '%'||trim(p_query)||'%' or m.claim ilike '%'||trim(p_query)||'%')
  order by case when m.tested_sha=lower(p_current_sha) then 0 else 1 end,
    case when m.status='PROMOTED' then 0 when m.status='VALIDATED' then 1 else 2 end,
    rank_score desc,m.confidence desc,m.last_validated_at desc nulls last
  limit greatest(1,least(50,p_limit));
$$;

revoke all on function public.flixo_require_agent_learning_service_role() from public,anon,authenticated;
revoke all on function public.flixo_submit_agent_memory(text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.flixo_review_agent_memory(uuid,text,text,text,jsonb,boolean,text) from public,anon,authenticated;
revoke all on function public.flixo_record_agent_memory_usage(uuid,text,text,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.flixo_reconcile_agent_memory(uuid,text) from public,anon,authenticated;
revoke all on function public.flixo_search_agent_memory(text,text,integer,boolean) from public,anon,authenticated;

grant execute on function public.flixo_require_agent_learning_service_role() to service_role;
grant execute on function public.flixo_submit_agent_memory(text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.flixo_review_agent_memory(uuid,text,text,text,jsonb,boolean,text) to service_role;
grant execute on function public.flixo_record_agent_memory_usage(uuid,text,text,text,text,jsonb,text) to service_role;
grant execute on function public.flixo_reconcile_agent_memory(uuid,text) to service_role;
grant execute on function public.flixo_search_agent_memory(text,text,integer,boolean) to service_role;
