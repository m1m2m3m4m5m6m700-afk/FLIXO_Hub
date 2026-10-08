# FLIXO Agent Memory OS + Economy v1

This layer advances the CELL from shared-memory records to semantic retrieval and from reputation-only routing to an auditable internal economy.

## Memory

- `public.flixo_agent_shared_memory.embedding` is a 384-dimensional pgvector field.
- HNSW cosine indexing is used for retrieval.
- `flixo_search_agent_memory_semantic` performs hybrid ranking: semantic similarity, lexical relevance, and confidence.
- `flixo-memory-embed` uses Supabase's hosted `gte-small` embedding model and returns exactly 384 dimensions.
- Semantic retrieval is called from the existing `cognitive-plane` path.
- Exact-SHA freshness remains a hard execution boundary. A stale memory may inform diagnostics but cannot become executable memory.
- Episodic recall is scoped to the current task and current SHA through `flixo_agent_learning_events`.
- The embedding writer and semantic search RPCs are service-role-only.

## Economy

- Wallets use internal credits only. There is no cash, token, blockchain, or external payment rail.
- Task price grows with difficulty and open demand.
- Solver staking is 25% of the quoted reward.
- A successful solution returns the stake and pays `2x` the quoted reward minus a 10% knowledge tax.
- Failed solutions burn the locked stake and reduce reputation.
- The verifier must be independent from the solver.
- Settlement is bound to the task's exact SHA.
- Economy ledger rows are append-only and linked by a SHA-256 chain.
- All economy mutation RPCs are service-role-only.
- Economy state has no planner, mutation, or certification authority.

## Runtime flow

`task -> exact-SHA context -> semantic memory + episodic recall -> economy quote -> economic solver eligibility -> canonical independent verifier -> solver stake -> settlement -> knowledge-fund tax -> learning evidence`

The production cognitive-learning facade now exposes the economy client and matchmaker. The economic layer may select an eligible solver when no solver is pre-assigned, but it cannot replace canonical assignment, planner authority, mutation authority, verifier independence, or certification authority.

## Operational bootstrap

On 2026-10-08 the live Supabase project was hardened and bootstrapped for the canonical registry:
- pgvector is enabled and the semantic memory RPC remains service-role-only.
- Eight Level 3/4 functions have fixed function-level `search_path` settings.
- `flixo-memory-embed` is active on version 2 and supports modern `sb_secret_*` API keys through the `apikey` header while preserving legacy service-role JWT compatibility.
- Settlement integrity requires an active verifier wallet and records the actual post-settlement reward balance in the append-only ledger.
- 11 registry-backed agent wallets were seeded with 1000 internal credits each. The separate `KNOWLEDGE_FUND` wallet remains at zero.
- The live economy ledger contained 11 bootstrap entries with zero broken hash links at verification time.

The memory corpus remains intentionally empty until real agent learning reports produce evidence-backed proposals. No synthetic lessons are promoted into executable memory.
