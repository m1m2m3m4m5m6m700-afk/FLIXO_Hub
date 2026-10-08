# FLIXO Agent Runtime State

Observed source SHA: `64587c0a20075a352ff2617785f6739009f413ee`
Observed at: 2026-10-08T14:21:07Z

## Current state

- Canonical integration lane: `execution`.
- Level 3 semantic memory is implemented through the existing Supabase `pgvector` substrate and a service-role semantic retrieval RPC.
- Level 4 economy substrate is implemented as internal credits, staking, exact-SHA settlement, independent-verifier enforcement, and an append-only SHA-256 ledger.
- Memory and economy state do not grant execution, promotion, deployment, or certification authority.
- The canonical promotion path remains `execution → protected PR → main`.
- Release certification is determined only by current exact-SHA CI and promotion evidence.

## Evidence boundary

These statements record observations made against the referenced source SHA. Any SHA drift requires revalidation before reuse as current evidence.
