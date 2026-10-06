# FLIXO Execution Ledger

This ledger records live execution tasks on the `execution` integration line. A task is not DONE unless implementation, verification, and auditable evidence are all present.

## Current candidate
- Branch: `execution`
- Current candidate SHA at this ledger reconciliation: `a8b9c55d8c6cd16abe96ce3362f5693db399823a`
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

## Current exact-SHA CI evidence — candidate `a8b9c55d8c6cd16abe96ce3362f5693db399823a`

- FLIXO Secret Scan: PASS.
- FLIXO CodeQL: PASS.
- FLIXO Final Clean-Clone Red Team: PASS.
- FLIXO CI `Typecheck, lint, core contracts, build`: PASS.
- FLIXO CI `Exact-SHA internal coverage`: PASS.
- FLIXO CI `Chromium browser smoke`: PASS.
- FLIXO CI `Red Team adversarial regression`: PASS.
- FLIXO CI `Branch policy`: FAIL CLOSED only at live main governance verification.
- FLIXO CI `trust-gate`: FAIL CLOSED because Branch policy failed.
- FLIXO CI `Exact-SHA promotion proof`: FAIL CLOSED because trust-gate failed.
- Production exact-SHA deployment: SKIPPED for the execution candidate; no production identity claim is made.

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
