# FLIXO Execution Ledger

This ledger records live execution tasks on the `execution` integration line. A task is not DONE unless implementation, verification, and auditable evidence are all present.

| TASK_ID | OWNER | STATUS | FILES_CHANGED | DEPENDENCIES | VALIDATION | EVIDENCE | NEXT_ACTION |
|---|---|---|---|---|---|---|---|
| EXEC-VIDEO-RACE-001 | AGENT-1/Runtime | IMPLEMENTED | `src/lib/video/video-executor.ts`, `src/lib/execution/canonical-executor.ts` | Browser media events | Static contract checks added; live Browser E2E pending | Commits `3857bcf`, `30bd166` | Re-run exact-SHA Browser E2E and verify real WebM artifact |
| EXEC-SCOPE-001 | AGENT-3/QA | IMPLEMENTED | `tests/official/image-toolkit-wave1.spec.ts` | MVP scope registry | Test now asserts unreleased IDs remain unavailable | Commit `98680f4` | Confirm G4 / scope regression remains green on current SHA |
| EXEC-I18N-001 | AGENT-2/Product | IMPLEMENTED | `src/routes/home-page.tsx` | 20-locale HOME copy | Localized Agent labels added for all configured locales | Commit `5ec85b9` | Re-run G4 all-public-route localization contract |
| EXEC-FILE-SAFETY-001 | AGENT-1/Runtime | VERIFIED-STATIC | `src/lib/execution/canonical-executor.ts`, existing contract tests | File Safety contract semantics | Canonical executor now uses bounded probe length for probe content; full Blob size remains checked before probe | Commit `751ca6c`; `tests/canonical-execution-boundary.test.ts` contract guard | Confirm latest Browser E2E removes common size/content mismatch failures |
| EXEC-LEDGER-001 | ALL | IN_PROGRESS | `docs/FLIXO-EXECUTION-LEDGER.md` | Current execution SHA | Ledger created on current branch | Current execution head at ledger creation: `751ca6cd8c2f5df23f6633392269a04d97b93235` | Keep updating until certification |
| EXEC-CERT-BLOCKER-001 | AGENT-3/Certification | BLOCKED | Repository ruleset / PR review state | External GitHub review authority | Live ruleset requires at least one approving review; connector cannot fabricate human approval | Prompt-01 state + live branch protection inspection | Complete all technical gates; final certification requires legitimate approval |

## Exact-SHA rule

When `execution` advances, all prior runtime/CI/certification evidence becomes stale unless it explicitly references and validates the new head SHA.

## Status semantics

`IMPLEMENTED` means code exists.
`VERIFIED-STATIC` means repository-level deterministic verification exists.
`VERIFIED` means live runtime/CI evidence exists for the exact current SHA.
`CERTIFIED` is the only DONE state for release purposes.
