# FLIXO Engineering Decisions

## DEC-20261008-001: Extend pgvector instead of adding Qdrant

Decision: use the existing Supabase `pgvector` shared-memory substrate rather than adding a second vector database.

Reason: the repository already contains provenance, exact-SHA controls, and HNSW vector infrastructure. One memory authority reduces synchronization and operational drift.

## DEC-20261008-002: Keep the economy internal and auditable

Decision: use internal credits and an append-only SHA-256 ledger instead of real money or blockchain.

Reason: the incentive layer needs deterministic accounting and auditability without creating financial custody or a second trust infrastructure.

## DEC-20261008-003: Memory never grants authority

Decision: semantic or episodic memory may improve context and routing but cannot bypass admission, execution, verification, promotion, or certification.

Reason: stale knowledge must remain non-executable and exact-SHA freshness is a hard trust boundary.

Recorded from implementation work observed at source SHA `64587c0a20075a352ff2617785f6739009f413ee`.
