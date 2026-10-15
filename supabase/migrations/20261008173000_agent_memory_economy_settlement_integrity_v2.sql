-- FLIXO Level 4: settlement integrity hardening.
-- Prevent non-existent/inactive verifiers and keep the append-only ledger balances auditable.

create or replace function public.flixo_economy_settle_task(
  p_task_id text,
  p_verifier_agent text,
  p_outcome text,
  p_exact_sha text,
  p_evidence_refs jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
declare
  v_task public.flixo_agent_economy_tasks%rowtype;
  v_solver public.flixo_agent_economy_wallets%rowtype;
  v_verifier public.flixo_agent_economy_wallets%rowtype;
  v_fund public.flixo_agent_economy_wallets%rowtype;
  v_tax numeric;
  v_payout numeric;
  v_total numeric;
  v_before numeric;
  v_hash text;
  v_prev text;
begin
  perform public.flixo_require_agent_learning_service_role();

  if upper(trim(p_outcome)) not in ('SUCCESS','FAILURE') then
    raise exception 'INVALID_SETTLEMENT_OUTCOME';
  end if;
  if p_exact_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'INVALID_EXACT_SHA';
  end if;
  if jsonb_typeof(p_evidence_refs) <> 'array' then
    raise exception 'INVALID_EVIDENCE_REFS';
  end if;

  select *
    into v_task
    from public.flixo_agent_economy_tasks
   where task_id = trim(p_task_id)
   for update;

  if not found then raise exception 'ECONOMY_TASK_NOT_FOUND'; end if;
  if v_task.status <> 'CLAIMED' then raise exception 'ECONOMY_TASK_NOT_CLAIMED'; end if;
  if lower(v_task.exact_sha) <> lower(p_exact_sha) then raise exception 'ECONOMY_EXACT_SHA_MISMATCH'; end if;
  if trim(p_verifier_agent) = '' then raise exception 'VERIFIER_REQUIRED'; end if;
  if trim(p_verifier_agent) = trim(v_task.solver_agent) then raise exception 'INDEPENDENT_VERIFIER_REQUIRED'; end if;

  select *
    into v_solver
    from public.flixo_agent_economy_wallets
   where agent_id = v_task.solver_agent
   for update;

  if not found then raise exception 'ECONOMY_SOLVER_WALLET_NOT_FOUND'; end if;

  select *
    into v_verifier
    from public.flixo_agent_economy_wallets
   where agent_id = trim(p_verifier_agent)
   for update;

  if not found then raise exception 'ECONOMY_VERIFIER_WALLET_NOT_FOUND'; end if;
  if v_verifier.status <> 'ACTIVE' then raise exception 'ECONOMY_VERIFIER_WALLET_INACTIVE'; end if;

  insert into public.flixo_agent_economy_wallets(agent_id,role,balance_credits)
  values('KNOWLEDGE_FUND','SYSTEM',0)
  on conflict (agent_id) do nothing;

  select *
    into v_fund
    from public.flixo_agent_economy_wallets
   where agent_id = 'KNOWLEDGE_FUND'
   for update;

  if upper(trim(p_outcome)) = 'SUCCESS' then
    v_tax := floor(v_task.quoted_reward * 0.10);
    v_payout := (2 * v_task.quoted_reward) - v_tax;
    v_total := v_task.stake_required + v_payout;

    update public.flixo_agent_economy_wallets
       set balance_credits = balance_credits + v_total,
           staked_credits = greatest(0, staked_credits - v_task.stake_required),
           lifetime_earned = lifetime_earned + v_payout,
           tasks_won = tasks_won + 1,
           reputation = least(100, reputation + 1.0),
           updated_at = now()
     where agent_id = v_solver.agent_id
     returning balance_credits into v_before;

    update public.flixo_agent_economy_wallets
       set balance_credits = balance_credits + v_tax,
           lifetime_earned = lifetime_earned + v_tax,
           updated_at = now()
     where agent_id = 'KNOWLEDGE_FUND';

    update public.flixo_agent_economy_tasks
       set verifier_agent = trim(p_verifier_agent),
           status = 'SETTLED_SUCCESS',
           settled_at = now(),
           settlement_outcome = 'SUCCESS',
           settlement_exact_sha = lower(p_exact_sha),
           updated_at = now()
     where task_id = v_task.task_id;
  else
    v_tax := 0;
    v_payout := 0;
    v_total := 0;

    update public.flixo_agent_economy_wallets
       set staked_credits = greatest(0, staked_credits - v_task.stake_required),
           lifetime_lost = lifetime_lost + v_task.stake_required,
           tasks_lost = tasks_lost + 1,
           reputation = greatest(0, reputation - 2.0),
           updated_at = now()
     where agent_id = v_solver.agent_id
     returning balance_credits into v_before;

    update public.flixo_agent_economy_tasks
       set verifier_agent = trim(p_verifier_agent),
           status = 'SETTLED_FAILURE',
           settled_at = now(),
           settlement_outcome = 'FAILURE',
           settlement_exact_sha = lower(p_exact_sha),
           updated_at = now()
     where task_id = v_task.task_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('flixo-economy-ledger', 0));
  select entry_hash
    into v_prev
    from public.flixo_agent_economy_ledger
   order by entry_id desc
   limit 1;
  v_prev := coalesce(v_prev, '');

  v_hash := encode(
    digest(
      v_prev || '|' || v_task.task_id || '|' || v_solver.agent_id || '|' ||
      case when upper(trim(p_outcome)) = 'SUCCESS' then 'REWARD' else 'SLASH' end || '|' ||
      v_task.exact_sha || '|' || v_total::text || '|' || v_tax::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.flixo_agent_economy_ledger(
    task_id,
    agent_id,
    event_type,
    amount_credits,
    balance_before,
    balance_after,
    exact_sha,
    evidence_refs,
    previous_entry_hash,
    entry_hash,
    metadata
  )
  values(
    v_task.task_id,
    v_solver.agent_id,
    case when upper(trim(p_outcome)) = 'SUCCESS' then 'REWARD' else 'SLASH' end,
    case when upper(trim(p_outcome)) = 'SUCCESS' then v_total else 0 end,
    v_before,
    case when upper(trim(p_outcome)) = 'SUCCESS' then v_before + v_total else v_before end,
    v_task.exact_sha,
    p_evidence_refs,
    v_prev,
    v_hash,
    jsonb_build_object(
      'verifier_agent', trim(p_verifier_agent),
      'tax', v_tax,
      'quoted_reward', v_task.quoted_reward,
      'stake_slashed', case when upper(trim(p_outcome)) = 'FAILURE' then v_task.stake_required else 0 end
    )
  );

  if upper(trim(p_outcome)) = 'SUCCESS' and v_tax > 0 then
    v_prev := v_hash;
    v_hash := encode(
      digest(
        v_prev || '|' || v_task.task_id || '|KNOWLEDGE_FUND|TAX|' ||
        v_tax::text || '|' || v_task.exact_sha,
        'sha256'
      ),
      'hex'
    );

    insert into public.flixo_agent_economy_ledger(
      task_id,
      agent_id,
      event_type,
      amount_credits,
      balance_before,
      balance_after,
      exact_sha,
      evidence_refs,
      previous_entry_hash,
      entry_hash,
      metadata
    )
    values(
      v_task.task_id,
      'KNOWLEDGE_FUND',
      'TAX',
      v_tax,
      v_fund.balance_credits,
      v_fund.balance_credits + v_tax,
      v_task.exact_sha,
      p_evidence_refs,
      v_prev,
      v_hash,
      jsonb_build_object('rate', 0.10, 'solver_agent', v_solver.agent_id)
    );
  end if;

  return jsonb_build_object(
    'task_id', v_task.task_id,
    'outcome', upper(trim(p_outcome)),
    'solver_agent', v_solver.agent_id,
    'verifier_agent', trim(p_verifier_agent),
    'stake', v_task.stake_required,
    'quoted_reward', v_task.quoted_reward,
    'tax', v_tax,
    'payout', v_payout,
    'success_multiple', case when upper(trim(p_outcome)) = 'SUCCESS' then 2.0 else 0.0 end,
    'knowledge_fund', 'KNOWLEDGE_FUND',
    'exact_sha', v_task.exact_sha
  );
end;
$$;

revoke all on function public.flixo_economy_settle_task(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.flixo_economy_settle_task(text,text,text,text,jsonb) to service_role;
