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

`task -> exact-SHA context -> semantic memory + episodic recall -> solver economy quote -> solver stake -> independent verification -> settlement -> knowledge-fund tax`

The economy is intentionally a substrate first. Matchmaking may consume its quote/reputation signals later, but economic state cannot override repository governance or certification gates.
