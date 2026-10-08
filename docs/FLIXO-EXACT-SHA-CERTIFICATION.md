# FLIXO Exact-SHA Certification Record

STATUS: AUTONOMOUS-MERGE / AUTOMATED-GATES

This file indexes evidence policy. It never substitutes for live GitHub state.

## Authority chain

1. Current `execution` is the integration candidate source.
2. The promotion path is the protected `execution -> main` pull request.
3. Required CI, security, browser, Red-Team, and exact-SHA evidence must match the candidate SHA.
4. GitHub rulesets are live external enforcement.
5. Human approval is not a promotion prerequisite. Automated required checks are.

## Autonomous merge target

For `main`:
- zero required approving reviews;
- no Code Owner review requirement;
- no latest-push approval requirement;
- no review-thread approval requirement;
- required `trust-gate`;
- required `Exact-SHA promotion proof`.

The merge actor may be an authorized automation/agent identity. Direct writes to the `main` ref remain forbidden.

## Evidence rule

Every mutation to `execution` creates a new candidate SHA and invalidates older candidate-specific evidence. Pending, skipped, cancelled, neutral, stale, or mismatched evidence is not PASS.

## Post-merge record

A merge report is generated only after a PR is actually merged into `main`. The report is bound to the merge commit and source head SHA and is observational, not an approval gate.

## Certification state

Final product/production claims still require their own exact-SHA evidence. This document does not turn a successful merge into a production certification.
