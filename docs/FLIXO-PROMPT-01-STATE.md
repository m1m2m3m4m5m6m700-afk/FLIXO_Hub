# FLIXO Prompt 01 — Exact-SHA State Reconciliation

Status: CURRENT TEMPLATE / NOT CERTIFICATION

This file records the reconciliation protocol and must not embed mutable SHA-specific PASS claims. Resolve the live refs from GitHub when Prompt 01 is executed.

- Production truth: `main`
- Integration lane: `execution`
- Current release PR: #1002
- Authoritative scope: `docs/MVP-SCOPE-DECISION.md`
- Canonical registry: `src/config/registry.ts`
- Canonical execution authority: `src/lib/execution/canonical-executor.ts`

## Required live evidence
- CURRENT_MAIN_SHA
- CURRENT_EXECUTION_SHA
- PR_HEAD_SHA
- PR_BASE_SHA
- required workflow/check states for the exact PR head
- stale evidence invalidation
- governance blockers

## Rule
Any repository mutation invalidates SHA-specific evidence from the previous candidate. This record never upgrades itself to PASS; Prompt 19 is the certification authority.
