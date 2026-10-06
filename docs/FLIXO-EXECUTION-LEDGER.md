# FLIXO Execution Ledger

This ledger records execution coordination metadata on the `execution` integration line. It is not a certification authority.

## Current candidate

- Branch: `execution`
- CURRENT_SHA=REQUIRED
- CURRENT_WORKFLOW_RUN=REQUIRED
- CURRENT_EVIDENCE=REQUIRED
- Integration PR: `REQUIRED`
- Production truth branch: `main`
- Production identity: `REQUIRED`
- Exact-SHA evidence must be regenerated after any execution mutation.

| TASK_ID | OWNER | STATUS | FILES_CHANGED | DEPENDENCIES | VALIDATION | EVIDENCE | NEXT_ACTION |
|---|---|---|---|---|---|---|---|
| EXEC-PROMPT-10-SECURITY-001 | AGENT-3/Security | IN PROGRESS | `.github/CODEOWNERS`, `src/worker.ts`, `vercel.json`, `tests/worker-production-boundary.test.ts`, `tests/security-governance.test.ts`, `package.json`, `docs/FLIXO-PROMPT-10-STATE.md` | Prompt 10 security closure | Security fixes exist; final exact-SHA security evidence must be regenerated after the current lineage mutation | REQUIRED_CURRENT_EVIDENCE | Close only after current-SHA security gates pass |
| EXEC-VIDEO-RACE-001 | AGENT-1/Runtime | VERIFIED-STATIC | `src/lib/video/video-executor.ts`, `src/lib/execution/canonical-executor.ts` | Browser media events | Static contract checks exist; candidate-specific runtime evidence must be current before certification | REQUIRED_CURRENT_EVIDENCE | Revalidate on the final frozen candidate |
| EXEC-SCOPE-001 | AGENT-3/QA | IMPLEMENTED | `tests/official/image-toolkit-wave1.spec.ts` | MVP scope registry | Scope regression exists | REQUIRED_CURRENT_EVIDENCE | Keep exact-SHA scope regression in final gate |
| EXEC-FILE-SAFETY-001 | AGENT-1/Runtime | VERIFIED-STATIC | `src/lib/execution/canonical-executor.ts`, contract tests | File Safety contract semantics | Bounded file-signature and size checks exist | REQUIRED_CURRENT_EVIDENCE | Revalidate on the final frozen candidate |
| EXEC-IMG-WORKER-001 | AGENT-1/Runtime | VERIFIED-STATIC | `src/lib/execution/canonical-executor.ts`, `src/lib/execution/image-effects.worker.ts` | Worker availability, OffscreenCanvas | Worker boundary, timeout, abort cleanup, and fallback exist | REQUIRED_CURRENT_EVIDENCE | Revalidate on the final frozen candidate |
| EXEC-VIDEO-DOM-001 | AGENT-3/Security | VERIFIED-STATIC | `src/lib/execution/canonical-executor.ts`, `src/lib/video/video-executor.ts`, `src/lib/video/blob-video-source.ts` | Video source lifecycle | Canonical verifier/renderer use shared blob-backed source adapter | REQUIRED_CURRENT_EVIDENCE | Revalidate on the final frozen candidate |
| EXEC-SCOPE-CONSISTENCY-001 | AGENT-3/QA | VERIFIED-STATIC | `tests/mvp-scope-contradiction.test.ts` | Canonical capability definitions and registry | Exact ten-tool parity and contract bindings are regression-tested | REQUIRED_CURRENT_EVIDENCE | Keep locked |
| EXEC-SCOPE-CLAIMS-001 | AGENT-3/QA | VERIFIED-STATIC | `docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md` | Current ten-tool MVP scope | Public claims are constrained to canonical MVP scope | REQUIRED_CURRENT_EVIDENCE | Keep locked |
| EXEC-PROMPT-02-001 | AGENT-3/QA | IN PROGRESS | `docs/FLIXO-PROMPT-02-STATE.md`, scope test, public claims | Prompt 02 exact-SHA verification | Runtime contract alignment exists; final evidence remains candidate-sensitive | REQUIRED_CURRENT_EVIDENCE | Close after exact-SHA revalidation and external governance resolution |
| EXEC-MVP-NEG-ASSERT-001 | AGENT-3/QA | VERIFIED | `tests/mvp-acceptance-corpus.test.ts` | Node assert.throws behavior | Negative corpus assertions are explicit | REQUIRED_CURRENT_EVIDENCE | Re-run exact-SHA gates after mutation |
| EXEC-CERT-BLOCKER-001 | AGENT-3/Certification | BLOCKED | GitHub ruleset / PR review state | External repository governance | Main governance must be verified live; no historical review state can be reused | REQUIRED_CURRENT_EVIDENCE | Resolve only through legitimate repository administration and independent review |
| EXEC-DOCS-AUDIT-001 | AGENT-2/Product | IMPLEMENTED | `docs/TOOL-EXPANSION-AUDIT.md` | Exact execution candidate | Audit exists; candidate identity must advance with the current head | REQUIRED_CURRENT_EVIDENCE | Refresh only as candidate advances |

## Exact-SHA invalidation rule

When `execution` advances, all prior candidate-specific runtime, CI, browser, security, coverage, Red Team, deployment, and certification evidence becomes stale unless it explicitly references and validates the new head SHA.

## HISTORICAL / INVALIDATED — NOT CURRENT CERTIFICATION

STATUS=HISTORICAL — NOT CURRENT CERTIFICATION

The following lineage data is retained from earlier execution reconciliations:
- Historical ledger reconciliation candidate: `d7d0c2e6b7a07a044c3772f8382c3b5a1e4ac440`
- Historical fully verified candidate: `a44958a97126b2e050746010947aef2cfa286729`
- Historical evidence record commit: `bfa98f6da5bdc28b21c4f22a926d4c219a7230a2`
- Historical main SHA: `263827228cbe5f4851470297fde5f2858ff844de`
- Historical integration reference: PR #1002
- Historical Prompt 17 workflow run: 37437187406 / run #239
- Historical negative-corpus evidence commit: `bfa98f6da5bdc28b21c4f22a926d4c219a7230a2`
- Historical governance ruleset reference: 23854302
- Historical current-candidate rows and PASS claims are retained here only as archaeology and are invalid for the current candidate.
