# FLIXO Execution Ledger

This ledger records live execution tasks on the `execution` integration line. A task is not DONE unless implementation, verification, and auditable evidence are all present.

## Current candidate
- Branch: `execution`
- Current candidate SHA at this ledger reconciliation: `f76313b60e61c69e050473549a60f4612c959212`
- Integration PR: #1002
- Production truth branch: `main`
- Current main SHA: `263827228cbe5f4851470297fde5f2858ff844de`
- Exact-SHA evidence must be regenerated after any further execution mutation.

| TASK_ID | OWNER | STATUS | FILES_CHANGED | DEPENDENCIES | VALIDATION | EVIDENCE | NEXT_ACTION |
|---|---|---|---|---|---|---|---|
| EXEC-VIDEO-RACE-001 | AGENT-1/Runtime | VERIFIED-STATIC | `src/lib/video/video-executor.ts`, `src/lib/execution/canonical-executor.ts` | Browser media events | Static contract checks added; current candidate browser/Red Team evidence is PASS | Exact current-candidate CI/Red Team runs | Retain serial video E2E isolation and monitor current candidate |
| EXEC-SCOPE-001 | AGENT-3/QA | IMPLEMENTED | `tests/official/image-toolkit-wave1.spec.ts` | MVP scope registry | Scope regression test exists | Current candidate CI child jobs PASS | Keep exact-SHA scope regression in final gate |
| EXEC-FILE-SAFETY-001 | AGENT-1/Runtime | VERIFIED-STATIC | `src/lib/execution/canonical-executor.ts`, contract tests | File Safety contract semantics | Bounded signature probe and full Blob size checks implemented | Current candidate Red Team/CI PASS | No mutation unless a new gap appears |
| EXEC-IMG-WORKER-001 | AGENT-1/Runtime | VERIFIED-STATIC | `src/lib/execution/canonical-executor.ts`, `src/lib/execution/image-effects.worker.ts` | Worker availability, OffscreenCanvas | Worker boundary, bounded timeout, abort cleanup and fallback implemented | Current candidate Red Team/CI PASS | No mutation unless a new gap appears |
| EXEC-VIDEO-DOM-001 | AGENT-3/Security | VERIFIED-STATIC | `src/lib/execution/canonical-executor.ts`, `src/lib/video/video-executor.ts`, `src/lib/video/blob-video-source.ts` | Video source lifecycle | Canonical verifier/renderer use shared blob-backed source adapter | Current candidate CodeQL/Red Team evidence PASS | No mutation unless a new gap appears |
| EXEC-SCOPE-CONSISTENCY-001 | AGENT-3/QA | VERIFIED-STATIC | `tests/mvp-scope-contradiction.test.ts` | Canonical capability definitions and registry | Exact ten-tool parity, executor/output contract bindings, LOCAL/network=false, schemas/verifiers, documentation alignment | Current candidate CI PASS | Keep locked |
| EXEC-SCOPE-CLAIMS-001 | AGENT-3/QA | VERIFIED-STATIC | `docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md` | Current ten-tool MVP scope | Public claims aligned to ten canonical executable capabilities | Current candidate scope test/build PASS | Keep locked |
| EXEC-PROMPT-02-001 | AGENT-3/QA | IN_PROGRESS | `docs/FLIXO-PROMPT-02-STATE.md`, scope test, public claims | Prompt 02 exact-SHA verification | Runtime contract alignment is implemented; final certification evidence remains governance-blocked | Current candidate CI/coverage/browser/Red Team/security PASS except branch-policy governance | Close after governance blocker is legitimately removed and final certification rerun |
| EXEC-CERT-BLOCKER-001 | AGENT-3/Certification | BLOCKED | GitHub ruleset / PR review state | External repository governance | Live main ruleset has 0 required approvals and non-strict required checks; PR #1002 has no human approving review | Live ruleset inspection + PR review list | Harden Ruleset 23854302 and obtain legitimate independent approval |
| EXEC-DOCS-AUDIT-001 | AGENT-2/Product | IMPLEMENTED | `docs/TOOL-EXPANSION-AUDIT.md` | Exact execution candidate | Audit reconciled to active PR #1002 | Latest exact candidate requires state refresh after every mutation | Refresh only as candidate advances |

## Current exact-SHA CI evidence — candidate `f76313b60e61c69e050473549a60f4612c959212`

Latest exact-SHA execution-push evidence:
- FLIXO Secret Scan: PASS.
- FLIXO CodeQL: PASS.
- FLIXO Final Clean-Clone Red Team: PASS.
- FLIXO CI Typecheck/lint/core contracts/build: PASS.
- FLIXO CI Exact-SHA internal coverage: PASS.
- FLIXO CI Red Team adversarial regression: PASS.
- FLIXO CI Branch policy: PASS on execution push.
- FLIXO CI Chromium browser smoke: IN PROGRESS on the latest execution push; no browser PASS is claimed until completion.
- Exact-SHA PR branch-policy: FAIL CLOSED because the live main ruleset violates Prompt 12.
- PR trust-gate / promotion proof: not certifiable while the governance gate fails.
- Production exact-SHA deployment: SKIPPED on execution, by design; no production identity claim is made.

## Prompt-state reconciliation — current candidate
- Prompt 01: BLOCKER — live state reconciled; governance blocker remains.
- Prompt 02: VERIFIED-IMPLEMENTATION / exact final certification pending.
- Prompt 03: VERIFIED by canonical registry/executor/verifier/output-contract regression.
- Prompt 04: VERIFIED by Agent Guided + Manual browser/local execution coverage.
- Prompt 05: VERIFIED by trust-boundary and adversarial regression suites.
- Prompt 06: VERIFIED by browser-local media bounds, abort/timeout, signature, MIME, and output checks.
- Prompt 07: VERIFIED by deterministic positive/negative MVP acceptance corpus.
- Prompt 08: VERIFIED by output-integrity and capability-verifier coverage.
- Prompt 09: VERIFIED-IMPLEMENTATION by canonical Agent Guided runtime tests and exact-SHA CI.
- Prompt 10: VERIFIED for repository security gates; production governance remains blocked by Prompt 12.
- Prompt 11: VERIFIED for the current CI/release workflow graph.
- Prompt 12: BLOCKED — live ruleset 23854302 is under-hardened; connected GitHub mutation surface is read-only for ruleset administration.
- Prompt 13: VERIFIED by current repository hygiene and branch coordination policy.
- Prompt 14: IN_PROGRESS — current-state documents are being reconciled to exact candidate SHA.
- Prompt 15: BLOCKED until protected-main promotion and post-merge production identity verification.
- Prompt 16: VERIFIED — active MVP file-editing path is persistence-independent; Supabase remains outside raw MVP file execution.
- Prompt 17: VERIFIED on the execution-push clean-clone gate; the latest PR instance is still being finalized independently.
- Prompt 18: BLOCKED until a single final frozen candidate can satisfy governance and exact-SHA release gates.
- Prompt 19: BLOCKED until Prompt 12/18 conditions are satisfied.
- Prompt 20: BLOCKED until legitimate review/governance and protected promotion are available.

## Governance blocker

GitHub ruleset `FLIXO-MAIN-PROTECTION` (ID 23854302) is active for `main` but does not meet the Prompt-12 policy:
- required approving reviews = 0; required = 1
- dismiss stale reviews on push = false; required = true
- Code Owner review = false; required = true
- latest-push approval = false; required = true
- review-thread resolution = false; required = true
- strict required status checks = false; required = true

PR #1002 has no independent human APPROVE. The connected execution tool surface exposes ruleset administration as read-only, so this cannot be legitimately repaired through the current interface.

## Exact-SHA rule

When `execution` advances, all prior runtime/CI/certification evidence becomes stale unless it explicitly references and validates the new head SHA.

## Status semantics

`IMPLEMENTED` means code/documentation exists.
`VERIFIED-STATIC` means repository-level deterministic verification exists.
`VERIFIED` means live runtime/CI evidence exists for the exact current SHA.
`CERTIFIED` is the only DONE state for release purposes.
