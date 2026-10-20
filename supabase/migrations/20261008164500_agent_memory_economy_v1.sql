-- FLIXO Level 3 + Level 4: semantic memory and internal agent economy.
-- Authority remains service_role-only. No economy state grants execution/certification authority.

create extension if not exists vector with schema extensions;

create or replace function public.flixo_store_agent_memory_embedding(
  p_memory_id uuid,
  p_embedding extensions.vector(384)
)
returns jsonb
language plpgsql
as $$
declare
  v_sha text;
begin
  perform public.flixo_require_agent_learning_service_role();
  if p_embedding is null then raise exception 'MEMORY_EMBEDDING_REQUIRED'; end if;

  update public.flixo_agent_shared_memory
     set embedding = p_embedding
   where memory_id = p_memory_id
   returning tested_sha into v_sha;

  if not found then raise exception 'MEMORY_NOT_FOUND'; end if;

  return jsonb_build_object(
    'memory_id', p_memory_id,
    'embedded', true,
    'tested_sha', v_sha
  );
end;
$$;

create or replace function public.flixo_search_agent_memory_semantic(
  p_query_embedding extensions.vector(384) default null,
  p_query text default '',
  p_current_sha text default '',
  p_limit integer default 10,
  p_include_candidates boolean default false
)
returns table(
  memory_id uuid,
  knowledge_key text,
  revision integer,
  source_agent text,
  source_role text,
  kind text,
  title text,
  claim text,
  content text,
  status text,
  confidence numeric,
  utility_score numeric,
  tested_sha text,
  sha_freshness text,
  usable boolean,
  evidence_count integer,
  independent_confirmations integer,
  usage_count integer,
  helpful_count integer,
  harmful_count integer,
  semantic_score real,
  lexical_score real,
  rank_score real
)
language sql
stable
as $$
  with scored as (
    select
      m.*,
      case
        when p_query_embedding is not null and m.embedding is not null
        then greatest(0.0, least(1.0, 1.0 - (m.embedding <=> p_query_embedding)))::real
        else 0.0::real
      end as semantic_score,
      case
        when nullif(trim(p_query),'') is not null
        then ts_rank_cd(m.search_document, websearch_to_tsquery('simple', trim(p_query)))::real
        else 0.0::real
      end as lexical_score
    from public.flixo_agent_shared_memory m
    where m.status not in ('REVOKED','SUPERSEDED')
      and (p_include_candidates or m.status in ('VALIDATED','PROMOTED'))
      and (
        nullif(trim(p_query),'') is null
        or m.search_document @@ websearch_to_tsquery('simple',trim(p_query))
        or m.title ilike '%' || trim(p_query) || '%'
        or m.claim ilike '%' || trim(p_query) || '%'
        or p_query_embedding is not null
      )
  )
  select
    s.memory_id,s.knowledge_key,s.revision,s.source_agent,s.source_role,s.kind,s.title,
    s.claim,s.content,s.status,s.confidence,s.utility_score,s.tested_sha,
    case when s.tested_sha=lower(p_current_sha) then 'CURRENT_SHA' else 'STALE_EVIDENCE' end,
    (s.status='PROMOTED' and s.tested_sha=lower(p_current_sha)),
    s.evidence_count,s.independent_confirmations,s.usage_count,s.helpful_count,s.harmful_count,
    s.semantic_score,s.lexical_score,
    ((0.65*s.semantic_score) +
     (0.25*least(1.0,s.lexical_score)) +
     (0.10*greatest(0.0,least(1.0,s.confidence::real))))::real as rank_score
  from scored s
  order by
    case when s.tested_sha=lower(p_current_sha) then 0 else 1 end,
    case when s.status='PROMOTED' then 0 when s.status='VALIDATED' then 1 else 2 end,
    rank_score desc,
    s.last_validated_at desc nulls last
  limit greatest(1,least(50,p_limit));
$$;

revoke all on function public.flixo_store_agent_memory_embedding(uuid, extensions.vector) from public,anon,authenticated;
revoke all on function public.flixo_search_agent_memory_semantic(extensions.vector,text,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.flixo_store_agent_memory_embedding(uuid, extensions.vector) to service_role;
grant execute on function public.flixo_search_agent_memory_semantic(extensions.vector,text,text,integer,boolean) to service_role;

create table if not exists public.flixo_agent_economy_wallets (
  agent_id text primary key check (char_length(trim(agent_id)) between 1 and 120),
  role text not null check (char_length(trim(role)) between 1 and 120),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','RETIRED')),
  balance_credits numeric(20,0) not null default 1000 check (balance_credits >= 0),
  staked_credits numeric(20,0) not null default 0 check (staked_credits >= 0),
  lifetime_earned numeric(20,0) not null default 0 check (lifetime_earned >= 0),
  lifetime_lost numeric(20,0) not null default 0 check (lifetime_lost >= 0),
  reputation numeric(7,3) not null default 50 check (reputation between 0 and 100),
  tasks_won integer not null default 0 check (tasks_won >= 0),
  tasks_lost integer not null default 0 check (tasks_lost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flixo_agent_economy_tasks (
  task_id text primary key check (char_length(trim(task_id)) between 1 and 256),
  exact_sha text not null check (exact_sha ~ '^[0-9a-f]{40}$'),
  difficulty smallint not null check (difficulty between 1 and 10),
  base_reward numeric(20,0) not null check (base_reward > 0),
  quoted_reward numeric(20,0) not null check (quoted_reward > 0),
  stake_required numeric(20,0) not null check (stake_required > 0),
  demand_score numeric(12,4) not null default 0 check (demand_score >= 0),
  status text not null default 'OPEN' check (status in ('OPEN','CLAIMED','SETTLED_SUCCESS','SETTLED_FAILURE','CANCELLED')),
  solver_agent text references public.flixo_agent_economy_wallets(agent_id),
  verifier_agent text references public.flixo_agent_economy_wallets(agent_id),
  claimed_at timestamptz,
  settled_at timestamptz,
  settlement_outcome text check (settlement_outcome is null or settlement_outcome in ('SUCCESS','FAILURE')),
  settlement_exact_sha text check (settlement_exact_sha is null or settlement_exact_sha ~ '^[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (solver_agent is null or verifier_agent is null or solver_agent <> verifier_agent)
);

create table if not exists public.flixo_agent_economy_ledger (
  entry_id bigint generated always as identity primary key,
  task_id text references public.flixo_agent_economy_tasks(task_id),
  agent_id text not null references public.flixo_agent_economy_wallets(agent_id),
  event_type text not null check (event_type in ('SEED','STAKE_LOCK','REWARD','TAX','SLASH','REPUTATION')),
  amount_credits numeric(20,0) not null,
  balance_before numeric(20,0) not null check (balance_before >= 0),
  balance_after numeric(20,0) not null check (balance_after >= 0),
  exact_sha text,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  previous_entry_hash text not null default '',
  entry_hash text not null unique check (entry_hash ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);

create index if not exists flixo_agent_economy_tasks_open_idx
  on public.flixo_agent_economy_tasks(status,demand_score desc,created_at asc);
create index if not exists flixo_agent_economy_ledger_agent_idx
  on public.flixo_agent_economy_ledger(agent_id,created_at desc);
create index if not exists flixo_agent_economy_ledger_task_idx
  on public.flixo_agent_economy_ledger(task_id,created_at desc);

alter table public.flixo_agent_economy_wallets enable row level security;
alter table public.flixo_agent_economy_tasks enable row level security;
alter table public.flixo_agent_economy_ledger enable row level security;

drop policy if exists flixo_agent_economy_wallets_service_only on public.flixo_agent_economy_wallets;
create policy flixo_agent_economy_wallets_service_only
  on public.flixo_agent_economy_wallets for all to service_role using (true) with check (true);
drop policy if exists flixo_agent_economy_tasks_service_only on public.flixo_agent_economy_tasks;
create policy flixo_agent_economy_tasks_service_only
  on public.flixo_agent_economy_tasks for all to service_role using (true) with check (true);
drop policy if exists flixo_agent_economy_ledger_service_only on public.flixo_agent_economy_ledger;
create policy flixo_agent_economy_ledger_service_only
  on public.flixo_agent_economy_ledger for select to service_role using (true);

revoke all on public.flixo_agent_economy_wallets from anon,authenticated;
revoke all on public.flixo_agent_economy_tasks from anon,authenticated;
revoke all on public.flixo_agent_economy_ledger from anon,authenticated;
grant select,insert,update on public.flixo_agent_economy_wallets to service_role;
grant select,insert,update on public.flixo_agent_economy_tasks to service_role;
grant select on public.flixo_agent_economy_ledger to service_role;

create or replace function public.flixo_reject_economy_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ECONOMY_LEDGER_APPEND_ONLY';
end;
$$;

drop trigger if exists flixo_agent_economy_ledger_immutable on public.flixo_agent_economy_ledger;
create trigger flixo_agent_economy_ledger_immutable
  before update or delete on public.flixo_agent_economy_ledger
  for each row execute function public.flixo_reject_economy_ledger_mutation();

create or replace function public.flixo_economy_quote_task(
  p_difficulty smallint, p_base_reward numeric, p_open_demand numeric default 0
)
returns jsonb language plpgsql immutable as $$
declare
  v_multiplier numeric;
  v_reward numeric;
  v_stake numeric;
begin
  if p_difficulty < 1 or p_difficulty > 10 then raise exception 'INVALID_DIFFICULTY'; end if;
  if p_base_reward <= 0 then raise exception 'INVALID_BASE_REWARD'; end if;
  if p_open_demand < 0 then raise exception 'INVALID_DEMAND'; end if;
  v_multiplier := (1.00 + (p_difficulty::numeric * 0.20)) *
                  (1.00 + least(2.00, p_open_demand / 10.00));
  v_reward := greatest(1,ceil(p_base_reward * v_multiplier));
  v_stake := greatest(1,ceil(v_reward * 0.25));
  return jsonb_build_object(
    'difficulty',p_difficulty,'base_reward',p_base_reward,'demand_score',p_open_demand,
    'quoted_reward',v_reward,'stake_required',v_stake,
    'knowledge_tax_rate',0.10,'success_return_multiple',2.00,
    'pricing_model','difficulty_x_demand'
  );
end;
$$;

create or replace function public.flixo_economy_seed_wallet(
  p_agent_id text, p_role text, p_initial_balance numeric default 1000
)
returns jsonb language plpgsql as $$
declare
  v_before numeric;
  v_hash text;
  v_prev text;
begin
  perform public.flixo_require_agent_learning_service_role();
  if trim(p_agent_id) = '' then raise exception 'INVALID_AGENT_ID'; end if;
  if p_initial_balance < 0 then raise exception 'INVALID_INITIAL_BALANCE'; end if;
  insert into public.flixo_agent_economy_wallets(agent_id,role,balance_credits)
  values(trim(p_agent_id),trim(p_role),floor(p_initial_balance))
  on conflict (agent_id) do nothing;

  select balance_credits into v_before
  from public.flixo_agent_economy_wallets
  where agent_id=trim(p_agent_id) for update;

  perform pg_advisory_xact_lock(hashtextextended('flixo-economy-ledger',0));
  select entry_hash into v_prev
  from public.flixo_agent_economy_ledger order by entry_id desc limit 1;
  v_prev := coalesce(v_prev,'');
  v_hash := encode(digest(v_prev || '|' || trim(p_agent_id) || '|SEED|' || v_before::text, 'sha256'),'hex');

  insert into public.flixo_agent_economy_ledger(
    agent_id,event_type,amount_credits,balance_before,balance_after,
    previous_entry_hash,entry_hash,metadata
  ) values (
    trim(p_agent_id),'SEED',v_before,v_before,v_before,v_prev,v_hash,
    jsonb_build_object('role',trim(p_role))
  );
  return jsonb_build_object('agent_id',trim(p_agent_id),'balance_credits',v_before);
end;
$$;

create or replace function public.flixo_economy_open_task(
  p_task_id text,p_exact_sha text,p_difficulty smallint,p_base_reward numeric,p_open_demand numeric default 0
)
returns jsonb language plpgsql as $$
declare
  v_quote jsonb;
  v_status text;
begin
  perform public.flixo_require_agent_learning_service_role();
  if p_exact_sha !~ '^[0-9a-f]{40}$' then raise exception 'INVALID_EXACT_SHA'; end if;
  if trim(p_task_id) = '' then raise exception 'INVALID_TASK_ID'; end if;
  select status into v_status from public.flixo_agent_economy_tasks where task_id=trim(p_task_id);
  if v_status is not null and v_status <> 'OPEN' then raise exception 'ECONOMY_TASK_NOT_REOPENABLE'; end if;

  v_quote := public.flixo_economy_quote_task(p_difficulty,p_base_reward,p_open_demand);
  insert into public.flixo_agent_economy_tasks(
    task_id,exact_sha,difficulty,base_reward,quoted_reward,stake_required,demand_score
  )
  values(
    trim(p_task_id),lower(p_exact_sha),p_difficulty,p_base_reward,
    (v_quote->>'quoted_reward')::numeric,(v_quote->>'stake_required')::numeric,p_open_demand
  )
  on conflict (task_id) do update set
    exact_sha=excluded.exact_sha,difficulty=excluded.difficulty,base_reward=excluded.base_reward,
    quoted_reward=excluded.quoted_reward,stake_required=excluded.stake_required,
    demand_score=excluded.demand_score,updated_at=now();
  return jsonb_build_object('task_id',trim(p_task_id),'status','OPEN') || v_quote;
end;
$$;

create or replace function public.flixo_economy_claim_task(
  p_task_id text,p_agent_id text,p_role text
)
returns jsonb language plpgsql as $$
declare
  v_task public.flixo_agent_economy_tasks%rowtype;
  v_wallet public.flixo_agent_economy_wallets%rowtype;
  v_before numeric;
  v_hash text;
  v_prev text;
begin
  perform public.flixo_require_agent_learning_service_role();
  select * into v_task from public.flixo_agent_economy_tasks
  where task_id=trim(p_task_id) for update;
  if not found then raise exception 'ECONOMY_TASK_NOT_FOUND'; end if;
  if v_task.status <> 'OPEN' then raise exception 'ECONOMY_TASK_NOT_OPEN'; end if;
  if upper(trim(p_role)) <> 'SOLVER' then raise exception 'ONLY_SOLVER_CAN_CLAIM'; end if;

  select * into v_wallet from public.flixo_agent_economy_wallets
  where agent_id=trim(p_agent_id) for update;
  if not found then raise exception 'ECONOMY_WALLET_NOT_FOUND'; end if;
  if v_wallet.status <> 'ACTIVE' then raise exception 'ECONOMY_WALLET_INACTIVE'; end if;
  if v_wallet.balance_credits < v_task.stake_required then raise exception 'INSUFFICIENT_STAKE'; end if;

  update public.flixo_agent_economy_wallets
  set balance_credits=balance_credits-v_task.stake_required,
      staked_credits=staked_credits+v_task.stake_required,updated_at=now()
  where agent_id=v_wallet.agent_id returning balance_credits into v_before;

  perform pg_advisory_xact_lock(hashtextextended('flixo-economy-ledger',0));
  select entry_hash into v_prev from public.flixo_agent_economy_ledger order by entry_id desc limit 1;
  v_prev := coalesce(v_prev,'');
  v_hash := encode(digest(v_prev || '|' || v_task.task_id || '|' || v_wallet.agent_id ||
    '|STAKE_LOCK|' || v_task.stake_required::text || '|' || v_task.exact_sha,'sha256'),'hex');

  insert into public.flixo_agent_economy_ledger(
    task_id,agent_id,event_type,amount_credits,balance_before,balance_after,exact_sha,
    previous_entry_hash,entry_hash,metadata
  ) values (
    v_task.task_id,v_wallet.agent_id,'STAKE_LOCK',-v_task.stake_required,
    v_before+v_task.stake_required,v_before,v_task.exact_sha,v_prev,v_hash,
    jsonb_build_object('locked',v_task.stake_required)
  );

  update public.flixo_agent_economy_tasks
  set status='CLAIMED',solver_agent=v_wallet.agent_id,claimed_at=now(),updated_at=now()
  where task_id=v_task.task_id;

  return jsonb_build_object(
    'task_id',v_task.task_id,'solver_agent',v_wallet.agent_id,
    'stake_locked',v_task.stake_required,'remaining_balance',v_before,'exact_sha',v_task.exact_sha
  );
end;
$$;

create or replace function public.flixo_economy_settle_task(
  p_task_id text,p_verifier_agent text,p_outcome text,p_exact_sha text,p_evidence_refs jsonb default '[]'::jsonb
)
returns jsonb language plpgsql as $$
declare
  v_task public.flixo_agent_economy_tasks%rowtype;
  v_solver public.flixo_agent_economy_wallets%rowtype;
  v_fund public.flixo_agent_economy_wallets%rowtype;
  v_tax numeric;
  v_payout numeric;
  v_total numeric;
  v_before numeric;
  v_hash text;
  v_prev text;
begin
  perform public.flixo_require_agent_learning_service_role();
  if upper(trim(p_outcome)) not in ('SUCCESS','FAILURE') then raise exception 'INVALID_SETTLEMENT_OUTCOME'; end if;
  if p_exact_sha !~ '^[0-9a-f]{40}$' then raise exception 'INVALID_EXACT_SHA'; end if;
  if jsonb_typeof(p_evidence_refs) <> 'array' then raise exception 'INVALID_EVIDENCE_REFS'; end if;

  select * into v_task from public.flixo_agent_economy_tasks
  where task_id=trim(p_task_id) for update;
  if not found then raise exception 'ECONOMY_TASK_NOT_FOUND'; end if;
  if v_task.status <> 'CLAIMED' then raise exception 'ECONOMY_TASK_NOT_CLAIMED'; end if;
  if lower(v_task.exact_sha) <> lower(p_exact_sha) then raise exception 'ECONOMY_EXACT_SHA_MISMATCH'; end if;
  if trim(p_verifier_agent) = '' then raise exception 'VERIFIER_REQUIRED'; end if;
  if trim(p_verifier_agent)=trim(v_task.solver_agent) then raise exception 'INDEPENDENT_VERIFIER_REQUIRED'; end if;

  select * into v_solver from public.flixo_agent_economy_wallets
  where agent_id=v_task.solver_agent for update;
  if not found then raise exception 'ECONOMY_SOLVER_WALLET_NOT_FOUND'; end if;

  insert into public.flixo_agent_economy_wallets(agent_id,role,balance_credits)
  values('KNOWLEDGE_FUND','SYSTEM',0) on conflict (agent_id) do nothing;
  select * into v_fund from public.flixo_agent_economy_wallets
  where agent_id='KNOWLEDGE_FUND' for update;

  if upper(trim(p_outcome))='SUCCESS' then
    v_tax := floor(v_task.quoted_reward * 0.10);
    v_payout := (2 * v_task.quoted_reward) - v_tax;
    v_total := v_task.stake_required + v_payout;

    update public.flixo_agent_economy_wallets
    set balance_credits=balance_credits+v_total,
        staked_credits=greatest(0,staked_credits-v_task.stake_required),
        lifetime_earned=lifetime_earned+v_payout,tasks_won=tasks_won+1,
        reputation=least(100,reputation+1.0),updated_at=now()
    where agent_id=v_solver.agent_id returning balance_credits into v_before;

    update public.flixo_agent_economy_wallets
    set balance_credits=balance_credits+v_tax,lifetime_earned=lifetime_earned+v_tax,updated_at=now()
    where agent_id='KNOWLEDGE_FUND';

    update public.flixo_agent_economy_tasks
    set verifier_agent=trim(p_verifier_agent),status='SETTLED_SUCCESS',settled_at=now(),
        settlement_outcome='SUCCESS',settlement_exact_sha=lower(p_exact_sha),updated_at=now()
    where task_id=v_task.task_id;
  else
    v_tax := 0; v_payout := 0; v_total := 0;

    update public.flixo_agent_economy_wallets
    set staked_credits=greatest(0,staked_credits-v_task.stake_required),
        lifetime_lost=lifetime_lost+v_task.stake_required,tasks_lost=tasks_lost+1,
        reputation=greatest(0,reputation-2.0),updated_at=now()
    where agent_id=v_solver.agent_id returning balance_credits into v_before;

    update public.flixo_agent_economy_tasks
    set verifier_agent=trim(p_verifier_agent),status='SETTLED_FAILURE',settled_at=now(),
        settlement_outcome='FAILURE',settlement_exact_sha=lower(p_exact_sha),updated_at=now()
    where task_id=v_task.task_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('flixo-economy-ledger',0));
  select entry_hash into v_prev from public.flixo_agent_economy_ledger order by entry_id desc limit 1;
  v_prev := coalesce(v_prev,'');

  v_hash := encode(digest(v_prev || '|' || v_task.task_id || '|' || v_solver.agent_id || '|' ||
    case when upper(trim(p_outcome))='SUCCESS' then 'REWARD' else 'SLASH' end || '|' ||
    v_task.exact_sha || '|' || v_total::text || '|' || v_tax::text,'sha256'),'hex');

  insert into public.flixo_agent_economy_ledger(
    task_id,agent_id,event_type,amount_credits,balance_before,balance_after,exact_sha,
    evidence_refs,previous_entry_hash,entry_hash,metadata
  ) values (
    v_task.task_id,v_solver.agent_id,
    case when upper(trim(p_outcome))='SUCCESS' then 'REWARD' else 'SLASH' end,
    case when upper(trim(p_outcome))='SUCCESS' then v_total else 0 end,
    v_before,v_before,v_task.exact_sha,p_evidence_refs,v_prev,v_hash,
    jsonb_build_object('verifier_agent',trim(p_verifier_agent),'tax',v_tax,
      'quoted_reward',v_task.quoted_reward,'stake_slashed',case when upper(trim(p_outcome))='FAILURE' then v_task.stake_required else 0 end)
  );

  if upper(trim(p_outcome))='SUCCESS' and v_tax > 0 then
    v_prev := v_hash;
    v_hash := encode(digest(v_prev || '|' || v_task.task_id || '|KNOWLEDGE_FUND|TAX|' ||
      v_tax::text || '|' || v_task.exact_sha,'sha256'),'hex');

    insert into public.flixo_agent_economy_ledger(
      task_id,agent_id,event_type,amount_credits,balance_before,balance_after,exact_sha,
      evidence_refs,previous_entry_hash,entry_hash,metadata
    ) values (
      v_task.task_id,'KNOWLEDGE_FUND','TAX',v_tax,
      v_fund.balance_credits,v_fund.balance_credits+v_tax,v_task.exact_sha,
      p_evidence_refs,v_prev,v_hash,jsonb_build_object('rate',0.10,'solver_agent',v_solver.agent_id)
    );
  end if;

  return jsonb_build_object(
    'task_id',v_task.task_id,'outcome',upper(trim(p_outcome)),
    'solver_agent',v_solver.agent_id,'verifier_agent',trim(p_verifier_agent),
    'stake',v_task.stake_required,'quoted_reward',v_task.quoted_reward,
    'tax',v_tax,'payout',v_payout,'success_multiple',
    case when upper(trim(p_outcome))='SUCCESS' then 2.0 else 0.0 end,
    'knowledge_fund','KNOWLEDGE_FUND','exact_sha',v_task.exact_sha
  );
end;
$$;

revoke all on function public.flixo_economy_quote_task(smallint,numeric,numeric) from public,anon,authenticated;
revoke all on function public.flixo_economy_seed_wallet(text,text,numeric) from public,anon,authenticated;
revoke all on function public.flixo_economy_open_task(text,text,smallint,numeric,numeric) from public,anon,authenticated;
revoke all on function public.flixo_economy_claim_task(text,text,text) from public,anon,authenticated;
revoke all on function public.flixo_economy_settle_task(text,text,text,text,jsonb) from public,anon,authenticated;

grant execute on function public.flixo_economy_quote_task(smallint,numeric,numeric) to service_role;
grant execute on function public.flixo_economy_seed_wallet(text,text,numeric) to service_role;
grant execute on function public.flixo_economy_open_task(text,text,smallint,numeric,numeric) to service_role;
grant execute on function public.flixo_economy_claim_task(text,text,text) to service_role;
grant execute on function public.flixo_economy_settle_task(text,text,text,text,jsonb) to service_role;

insert into public.flixo_agent_economy_wallets(agent_id,role,balance_credits)
values('KNOWLEDGE_FUND','SYSTEM',0)
on conflict (agent_id) do nothing;
