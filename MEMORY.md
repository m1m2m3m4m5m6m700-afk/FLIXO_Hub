# FLIXO Shared Operational Memory

## Semantic memory

Observed source SHA: `64587c0a20075a352ff2617785f6739009f413ee`

- Shared memory preserves provenance, evidence, status, utility, usage, and tested SHA.
- Semantic retrieval uses a 384-dimensional embedding with hybrid semantic and lexical ranking.
- Only `PROMOTED` memory bound to the current exact SHA is executable knowledge.
- Episodic recall is scoped to task ID and exact SHA.
- The embedding writer and semantic retrieval RPC are service-role-only.
- `flixo-memory-embed` uses the hosted `gte-small` embedding model.
- Semantic retrieval can fall back to lexical retrieval unless strict semantic mode is enabled.

## Economy

- Wallets use internal credits only.
- Pricing combines task difficulty and open demand.
- Solver stake is 25% of the quoted reward.
- Successful settlement returns stake and pays 2x the quoted reward minus a 10% knowledge tax.
- Failed settlement burns the locked stake and reduces reputation.
- Solver and verifier identities must differ.
- Settlement is exact-SHA bound.
- The economy ledger is append-only and SHA-256 linked.
- Economy mutation RPCs are service-role-only and do not grant repository authority.

## Learning rule

Memory and economic signals are advisory substrates. Canonical execution remains governed by the repository control plane, exact-SHA checks, independent verification, and promotion gates.
