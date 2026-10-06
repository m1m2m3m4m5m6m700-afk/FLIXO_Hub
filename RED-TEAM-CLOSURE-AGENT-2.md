# RED-TEAM-CLOSURE-AGENT-2

STATUS: EVIDENCE_ONLY
PRODUCTION_CERTIFICATION: NOT_ISSUED
LANE: agent-2/redteam-closure-final-20261006
INTEGRATION_TARGET: execution
CURRENT_CANDIDATE_SHA: 088f0c834ceb13b808962cc4e73582e84d45eda4
BASE_EXECUTION_SHA: a39c8638dcd3fd0a5f27761584ce12bd3233d158

## Finding state

RT-03=CLOSED_CODE
RT-05=CLOSED_CODE
RT-06=CLOSED_OR_OWNER_ACTION
RT-07=CLOSED_OR_OWNER_ACTION
RT-11=CLOSED_CODE
RT-14=CLOSED_CODE
RT-15=CLOSED_CODE

## Repository-side closure

RT-03: TestSprite privileged credentials are restricted to canonical repository main. Pull requests and execution use an unprivileged exact-SHA native Playwright fallback with no TestSprite secret/variable references.

RT-05: Promotion verification requires the canonical repository, canonical PR head/base repositories, exact PR head SHA, unchanged live base SHA, and merge-base equality. Fork origins and stale candidates fail closed.

RT-06: The repository branch policy fails closed for unknown branch references. The known legacy Agent 2 branch is quarantined from promotion lineage by the promotion verifier. Live execution protection is a GitHub governance control outside the connected write surface.

RT-07: Promotion proof rejects moved base and merge-base mismatch. The live main ruleset must still be strict; current observation has strict_required_status_checks_policy=false.

RT-11: A machine-checkable test rejects third-party GitHub Actions that are not pinned to 40-hex commit SHAs.

RT-14: The post-build src/worker.ts rewrite was removed. Production deployment now asserts exact checkout identity and a clean tracked worktree before Cloudflare deployment; runtime SHA is supplied explicitly by the deployment variable.

RT-15: CodeQL requests security-events:write and persists SARIF with upload: always; upload: never is rejected by regression tests.

## Exact-SHA rule

Every mutation creates a new candidate. No prior CI, browser, security, coverage, CodeQL, TestSprite, or production evidence is valid for a later SHA.

## Live governance blockers

- execution currently reports protected=false and required status checks off.
- Main ruleset 23854302 is active but currently reports zero required approvals and strict_required_status_checks_policy=false.
- The connected GitHub integration can read these controls but cannot mutate the ruleset/protection configuration.
- No production certification is issued by this lane.

## Required owner actions

1. Protect execution with strict current required status checks and approved promotion sources.
2. Update main ruleset 23854302 to strict required status checks and the intended independent review policy.
3. Retire stale legacy branches where no longer needed.
4. Re-run and record all exact-SHA CI/security/browser/coverage/CodeQL evidence after the final execution head is stable.

## Candidate synchronization

This commit intentionally changes only this evidence record to force a fresh pull-request synchronization event. All previous candidate evidence is invalidated by the new head SHA.

## Latest exact-SHA evidence boundary

At candidate `088f0c834ceb13b808962cc4e73582e84d45eda4`: Red Team adversarial regression PASS; Branch policy PASS; Gitleaks PASS; Chromium video/media assurance PASS. The general Typecheck/Lint/Core Contracts/Build gate fails on an existing Arabic-intent regression in `tests/agent-guided-runtime.test.ts`, and the Native exact-SHA TestSprite fallback fails on `video-trimmer` (17 passed, 2 failed). Those source paths are owned by concurrent agent lanes and were intentionally not modified here. Therefore trust-gate and promotion-proof remain fail-closed.
