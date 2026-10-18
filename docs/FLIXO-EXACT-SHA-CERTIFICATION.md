# FLIXO Exact-SHA Certification Record

STATUS: POLICY-ALIGNED / MAIN-RULESET-VERIFIED / PROMOTION-AND-DEPLOYMENT-BLOCKED

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

## Live main ruleset snapshot (read-only verification)

Observed 2026-10-18 through the GitHub repository rulesets API:
- Ruleset: `FLIXO-MAIN-PROTECTION`, ID `23854302`, enforcement `active`.
- Target: `refs/heads/main`.
- Required pull-request controls: 1 approving review, stale-review dismissal on push, Code Owner review, latest-push approval, review-thread resolution, and extra approval for unattributed changes.
- Required status checks: strict policy with `trust-gate` and `Exact-SHA promotion proof`.
- Deletion and non-fast-forward rules are enabled; no bypass actors are configured, and the API reports `current_user_can_bypass: never`.
- Read-only source: https://api.github.com/repos/m1m2m3m4m5m6m700-afk/FLIXO_Hub/rulesets/23854302

This snapshot verifies the configured repository ruleset at observation time. It does not approve the current release PR, establish that the required independent review has been given, or prove production deployment. Recheck the ruleset if its configuration or enforcement changes.
 
## Evidence rule

Every mutation to `execution` creates a new candidate SHA and invalidates older candidate-specific evidence. Pending, skipped, cancelled, neutral, stale, or mismatched evidence is not PASS.

## Post-merge record

A merge report is generated only after a PR is actually merged into `main`. The report is bound to the merge commit and source head SHA and is observational, not an approval gate.

## Certification state

Final product/production claims still require their own exact-SHA evidence. The live main ruleset was observed active and aligned with the configured required controls, but review, promotion, production deployment, and post-deployment evidence remain separate release gates.
