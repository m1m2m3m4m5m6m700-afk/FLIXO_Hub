-- FLIXO Level 4: bootstrap the canonical agent wallets.
-- Only registry-backed agents are created. No synthetic agents are introduced.
-- Each inserted wallet gets a genesis SEED ledger entry chained to the previous entry.

do $$
declare
  v_agent record;
  v_prev text;
  v_hash text;
  v_balance numeric := 1000;
begin
  perform pg_advisory_xact_lock(hashtextextended('flixo-economy-ledger', 0));

  for v_agent in
    select *
    from (values
      ('AGENT-01','EXPLORER'),
      ('AGENT-02','DEVELOPER'),
      ('AGENT-03','I18N'),
      ('AGENT-04','MAINTAINER'),
      ('AGENT-05','QA_VERIFIER'),
      ('AGENT-06','RED_TEAM'),
      ('AGENT-07','RED_TEAM'),
      ('AGENT-08','ARCHITECTURE_SCOUT'),
      ('AGENT-09','TECHNOLOGY_SCOUT'),
      ('AGENT-10','ECOSYSTEM_SCOUT'),
      ('SUPPORT-EXPLORER-02','SUPPORT_EXPLORER')
    ) as canonical(agent_id, role)
  loop
    insert into public.flixo_agent_economy_wallets(agent_id, role, balance_credits)
    values(v_agent.agent_id, v_agent.role, v_balance)
    on conflict (agent_id) do nothing;

    if found then
      select coalesce(
        (select entry_hash
           from public.flixo_agent_economy_ledger
          order by entry_id desc
          limit 1),
        ''
      ) into v_prev;

      v_hash := encode(
        digest(
          v_prev || '|' || v_agent.agent_id || '|SEED|' || v_balance::text,
          'sha256'
        ),
        'hex'
      );

      insert into public.flixo_agent_economy_ledger(
        agent_id,
        event_type,
        amount_credits,
        balance_before,
        balance_after,
        previous_entry_hash,
        entry_hash,
        metadata
      )
      values(
        v_agent.agent_id,
        'SEED',
        v_balance,
        v_balance,
        v_balance,
        v_prev,
        v_hash,
        jsonb_build_object(
          'bootstrap', true,
          'source', 'canonical-agent-registry',
          'role', v_agent.role
        )
      );
    end if;
  end loop;
end;
$$;
