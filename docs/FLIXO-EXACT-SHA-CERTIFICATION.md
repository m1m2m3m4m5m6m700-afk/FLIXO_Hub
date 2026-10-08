# FLIXO Exact-SHA Certification Record

STATUS: POLICY-ALIGNED / LIVE-GOVERNANCE-BLOCKED

This file indexes evidence policy. It never substitutes for live GitHub state.

## Authority chain

1. Current `execution` is the integration candidate source.
2. The promotion path is the protected `execution -> main` pull request.
3. Required CI, security, browser, Red-Team, and exact-SHA evidence must match the candidate SHA.
4. GitHub rulesets are live external enforcement.
5. Legitimate independent governance approval remains part of final promotion policy.

## Canonical governance target

For `main`:
- at least 1 approving review;
- dismiss stale approvals on push;
- require Code Owner review;
- require independent latest-push approval;
- resolve review threads before merge;
- enforce strict required status checks;
- require `trust-gate`;
- require `Exact-SHA promotion proof`.

Direct writes to the `main` ref remain forbidden.

## Evidence rule

Every mutation to `execution` creates a new candidate SHA and invalidates older candidate-specific evidence. Pending, skipped, cancelled, neutral, stale, or mismatched evidence is not PASS.

## Post-merge record

A merge report is generated only after a PR is actually merged into `main`. The report is bound to the merge commit and source head SHA and is observational, not an approval gate.

## Certification state

Final product/production claims still require their own exact-SHA evidence. Current live GitHub governance remains a release blocker until the required ruleset controls are actually enforced.
