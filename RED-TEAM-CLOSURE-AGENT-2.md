# RED-TEAM-CLOSURE-AGENT-2

STATUS: EVIDENCE_ONLY
PRODUCTION_CERTIFICATION: NOT_ISSUED
LANE: agent-2/redteam-closure-20261006
INTEGRATION_TARGET: execution
CODE_HEAD_AT_CLOSURE_DOC_PARENT: 75e6939c40f2094080c69d101c2d1488125339a2

## Findings

| Finding | Status | Fix commit(s) | Evidence / Owner Action |
|---|---|---|---|
| RT-03 | CLOSED_CODE | 9e3aabd6630c40dc078a61473fa57a3a6b00c664 | TestSprite secret job restricted to canonical main; PR/execution native exact-SHA fallback has no secrets/vars. Fresh GitHub Actions execution on this lane is still required. |
| RT-05 | CLOSED_CODE | dd3c32fce344b26efc33e585991c7d7331d3be65; 04707bc3433e933bf2efd684c6490d56c0ea2e51 | Promotion verifier checks canonical head/base repositories, exact PR head, live base SHA, and merge-base. Fresh GitHub Actions execution on this lane is still required. |
| RT-06 | CLOSED_OR_OWNER_ACTION | ca87564fd659c61174b137bd0983aa710f1fe6dc | Repository-side branch policy is fail-closed for unknown/new legacy refs and dated agent coordination refs. Live execution branch protection cannot be verified with current integration. Owner Action: configure and verify GitHub protection/ruleset for `execution`; remove/quarantine stale legacy refs. |
| RT-07 | CLOSED_OR_OWNER_ACTION | dd3c32fce344b26efc33e585991c7d7331d3be65; 04707bc3433e933bf2efd684c6490d56c0ea2e51 | Promotion verifier rejects stale base and merge-base mismatch. Live main ruleset `23854302` currently reports `strict_required_status_checks_policy=false`; therefore strict enforcement remains Owner Action. |
| RT-11 | CLOSED_CODE | 75e6939c40f2094080c69d101c2d1488125339a2 | Added machine-checkable immutable Action pinning test. Static audit found all third-party `uses:` references in the current workflow set pinned to 40-hex commit SHAs. Fresh CI execution remains required. |
| RT-14 | CLOSED_CODE | 69ed37b0b7eaee66cc6589bbdb2152c807b9fe5d | Removed post-build `src/worker.ts` rewrite and added tracked-worktree purity assertions before deployment. `wrangler.jsonc` uses `src/worker.ts` as the Worker entry and `dist` as assets; runtime SHA remains explicitly supplied by `--var FLIXO_DEPLOYMENT_SHA`. Fresh deployment-path validation remains required. |
| RT-15 | CLOSED_CODE | 0ea898d33b2b87a357e9161b767704b6227cb6c1 | CodeQL analysis now requests `security-events: write` and `upload: always`; `upload: never` removed. Added regression assertion. Fresh CodeQL run remains required. |

## Regression Contracts

- `tests/ci-redteam-closure.test.mjs` covers fork-origin rejection, stale head/base, merge-base mismatch, immutable Action pinning, TestSprite secret separation, deployment worktree purity, branch-policy quarantine, and CodeQL persistence.
- `.github/workflows/ci.yml` invokes the closure contract suite and promotion-context verifier.
- `.github/workflows/testsprite-execution.yml` provides unprivileged exact-SHA native fallback for PR/execution validation.

## Live Verification State

At the time of this record, GitHub reported no check-runs/statuses for the closure PR head `75e6939c40f2094080c69d101c2d1488125339a2`. Therefore no CI PASS is claimed from absence of runs.

Current live ruleset observation: ruleset `23854302` targets `main`, is active, but reports `strict_required_status_checks_policy=false` and zero required approving reviews. The available integration cannot read branch-protection endpoints for `main` or `execution` (HTTP 403), so those live controls remain Owner Action.

## Required Owner Actions

1. Protect `execution` with a repository ruleset/branch protection policy that requires current, strict status checks and rejects non-canonical/fork promotion sources.
2. Change the live `main` ruleset required-status-check setting to strict and require the intended human review policy; verify it independently after the change.
3. Re-run the full CI/security/browser workflow set on the final exact head SHA after every mutation; stale evidence is invalidated.

## Certification Boundary

PRODUCTION_CERTIFICATION: NOT_ISSUED
RELEASE_STATUS: NOT_READY_UNTIL_FRESH_EXACT_SHA_VALIDATION_AND_OWNER_ACTIONS
