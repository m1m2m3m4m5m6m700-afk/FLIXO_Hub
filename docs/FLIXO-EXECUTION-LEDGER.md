# FLIXO Execution Ledger

This ledger records live execution tasks on the `execution` integration line. A task is not DONE unless implementation, verification, and auditable evidence are all present.

## Current candidate
- Branch: `execution`
- Current candidate SHA at this ledger reconciliation: `bfa98f6da5bdc28b21c4f22a926d4c219a7230a2`
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
| EXEC-MVP-NEG-ASSERT-001 | AGENT-3/QA | VERIFIED | `tests/mvp-acceptance-corpus.test.ts` | Node assert.throws behavior | Negative corpus assertion explicitly validates the thrown Error and required message classes | bfa98f6da5bdc28b21c4f22a926d4c219a7230a2; CI + Prompt 17 PASS | Re-run exact-SHA gates after any later mutation |
| EXEC-CERT-BLOCKER-001 | AGENT-3/Certification | BLOCKED | GitHub ruleset / PR review state | External repository governance | Live main ruleset has 0 required approvals and non-strict required checks; PR #1002 has no human approving review | Live ruleset inspection + PR review list | Harden Ruleset 23854302 and obtain legitimate independent approval |
| EXEC-DOCS-AUDIT-001 | AGENT-2/Product | IMPLEMENTED | `docs/TOOL-EXPANSION-AUDIT.md` | Exact execution candidate | Audit reconciled to active PR #1002 | Latest exact candidate requires state refresh after every mutation | Refresh only as candidate advances |

## Last fully verified exact-SHA CI evidence — candidate `bfa98f6da5bdc28b21c4f22a926d4c219a7230a2`

Exact candidate evidence before this documentation rollover:
- Typecheck/lint/core contracts/build: PASS.
- Exact-SHA internal coverage: PASS.
- Red Team adversarial regression: PASS.
- Prompt 17 clean-clone final adversarial gate: PASS.
- FLIXO CodeQL: PASS.
- Gitleaks / Secret Scan: PASS.
- TestSprite execution fallback: PASS.
- Execution-push branch policy: PASS with main governance intentionally deferred.
- PR-to-main branch policy: FAIL CLOSED because live ruleset 23854302 does not satisfy Prompt 12.
- Chromium browser smoke: PASS.
- Trust-gate / promotion proof: governance remains blocked by live main ruleset and missing independent human review.
- Production exact-SHA deployment: not applicable on execution by design; production truth begins on main after protected promotion.
All evidence above is tied to `bfa98f6da5bdc28b21c4f22a926d4c219a7230a2`. This documentation rollover changes the execution SHA, so candidate-specific PASS evidence must be regenerated on the new head.

## Prompt-state reconciliation — current candidate
- Prompt 01: BLOCKED_BY_EXTERNAL_GOVERNANCE — live execution/main state reconciled at b130f732ba4e333611040676ae3c21531480b62c.
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
- Prompt 14: VERIFIED-DOCS-ALIGNMENT — current-state documents reconciled without changing runtime authority.
- Prompt 15: BLOCKED until protected-main promotion and post-merge production identity verification.
- Prompt 16: VERIFIED — active MVP file-editing path is persistence-independent; Supabase remains outside raw MVP file execution.
- Prompt 17: VERIFIED on the pre-mutation exact candidate; clean-clone gate PASS.
- Prompt 18: BLOCKED until Prompt 12 and the post-mutation exact candidate gates are closed.
- Prompt 19: BLOCKED until Prompt 12 and Prompt 18 conditions are satisfied.
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
