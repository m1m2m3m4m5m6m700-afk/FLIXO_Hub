# FLIXO Execution Ledger

This ledger records live execution tasks on the `execution` integration line. A task is not DONE unless implementation, verification, and auditable evidence are all present.

## Current candidate
- Branch: `execution`
- Current candidate SHA at last ledger mutation: `972b34168f043c5bded68d39678390f3a1f780a7`
- Integration PR: #1002
- Production truth branch: `main`
- Current main SHA: `263827228cbe5f4851470297fde5f2858ff844de`
- Exact-SHA evidence must be regenerated after any further execution mutation.

| TASK_ID | OWNER | STATUS | FILES_CHANGED | DEPENDENCIES | VALIDATION | EVIDENCE | NEXT_ACTION |
|---|---|---|---|---|---|---|---|
| EXEC-VIDEO-RACE-001 | AGENT-1/Runtime | VERIFIED-STATIC | `src/lib/video/video-executor.ts`, `src/lib/execution/canonical-executor.ts` | Browser media events | Static contract checks added; exact-candidate browser proof pending | Historical runtime commits; current CI must revalidate | Re-run exact-SHA browser E2E and verify real WebM artifact |
| EXEC-SCOPE-001 | AGENT-3/QA | VERIFIED-STATIC | `tests/official/image-toolkit-wave1.spec.ts` | MVP scope registry | Scope regression test added historically | Commit `98680f4` | Re-run scope regression on current candidate |
| EXEC-FILE-SAFETY-001 | AGENT-1/Runtime | VERIFIED-STATIC | `src/lib/execution/canonical-executor.ts`, contract tests | File Safety contract semantics | Bounded signature probe and full Blob size checks implemented | Commit `751ca6c`; static test evidence | Fresh exact-SHA browser/security evidence |
| EXEC-IMG-WORKER-001 | AGENT-1/Runtime | VERIFIED-STATIC | `src/lib/execution/canonical-executor.ts`, `src/lib/execution/image-effects.worker.ts` | Worker availability, OffscreenCanvas | Worker boundary, bounded timeout, abort cleanup and fallback implemented | Historical commits + source inspection | Fresh exact-SHA CI/browser evidence |
| EXEC-VIDEO-DOM-001 | AGENT-3/Security | VERIFIED-STATIC | `src/lib/execution/canonical-executor.ts`, `src/lib/video/video-executor.ts`, `src/lib/video/blob-video-source.ts` | Video source lifecycle | Canonical verifier/renderer use shared blob-backed source adapter | Current execution lineage + source inspection | Fresh exact-SHA browser/CodeQL evidence |
| EXEC-SCOPE-CONSISTENCY-001 | AGENT-3/QA | IMPLEMENTED | `tests/mvp-scope-contradiction.test.ts` | Canonical capability definitions and registry | Test strengthened to assert exact ten-tool parity, executor/output contract bindings, LOCAL/network=false, schemas/verifiers, and documentation alignment | Commit `7a86c4a` | Validate on current candidate SHA `972b341` |
| EXEC-SCOPE-CLAIMS-001 | AGENT-3/QA | IMPLEMENTED | `docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md` | Current ten-tool MVP scope | Historical six-tool public-claims contradiction removed; ten canonical capabilities are now listed | Commit `bd4878c` | Validate public claims and documentation alignment on current candidate |
| EXEC-PROMPT-02-001 | AGENT-3/QA | IN_PROGRESS | `docs/FLIXO-PROMPT-02-STATE.md`, scope test, public claims | Prompt 02 exact-SHA verification | Runtime contract alignment recorded; candidate CI/Red Team/security evidence still pending | Current state file; candidate SHA `972b341` | Close only after exact-SHA test/build/browser/security evidence |
| EXEC-CERT-BLOCKER-001 | AGENT-3/Certification | BLOCKED | GitHub ruleset / PR review state | External repository governance | Live main ruleset has 0 required approvals and non-strict required checks; PR #1002 has no human approving review | Live ruleset inspection + PR review list | Complete all technical gates; legitimate human governance change/review remains required |
| EXEC-DOCS-AUDIT-001 | AGENT-2/Product | IMPLEMENTED | `docs/TOOL-EXPANSION-AUDIT.md` | Exact execution candidate | Audit reconciled to active PR #1002 and marks prior main evidence historical | Commit `8831489` | Reconcile again after the final candidate freeze |

## Current CI evidence observed on predecessor candidate
The immediately preceding candidate `7a86c4a0a604340b2d1519e8be64ce6f298bee13` had:
- Red Team adversarial regression: PASS.
- Branch policy job: FAIL only at the main-governance-ruleset verification.
- Secret Scan: PASS.
- Prompt 17 clean-clone workflow: started and reached Typecheck successfully.
- TestSprite fallback: running exact-SHA native Playwright because external credentials were unavailable.
These results are historical for `7a86c4a` and are invalidated by the later `972b341` mutation.

## Exact-SHA rule
When `execution` advances, all prior runtime/CI/certification evidence becomes stale unless it explicitly references and validates the new head SHA.

## Status semantics
`IMPLEMENTED` means code/documentation exists.
`VERIFIED-STATIC` means repository-level deterministic verification exists.
`VERIFIED` means live runtime/CI evidence exists for the exact current SHA.
`CERTIFIED` is the only DONE state for release purposes.
