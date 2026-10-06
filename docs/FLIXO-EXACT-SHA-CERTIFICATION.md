# FLIXO Exact-SHA Certification Record

STATUS: POLICY-ALIGNED / LIVE-GOVERNANCE-BLOCKED

This file is an evidence-policy index, not a substitute for live GitHub state and not a self-certifying record.

## Authority chain

1. Current `execution` ref is the candidate source.
2. PR #1002 is the integration path to `main`.
3. Required CI/security/browser/Red-Team evidence must be generated on the exact current candidate SHA.
4. GitHub rulesets and branch protection are external enforcement and must be queried live.
5. Human Authority remains the final promotion authority.

This document intentionally does not embed a historical candidate SHA as current certification evidence. Any SHA mentioned by an older release record is historical and cannot certify a newer candidate.

## Canonical governance target

The release governance target for `main` is:
- at least 1 approving review;
- dismiss stale approvals on push;
- require Code Owner review;
- require independent latest-push approval;
- resolve review threads before merge;
- enforce strict required status checks;
- require `trust-gate`;
- require `Exact-SHA promotion proof`.

## Current live governance observation

The active GitHub ruleset is `FLIXO-MAIN-PROTECTION` (ID `23854302`) targeting `refs/heads/main`.

At the last live reconciliation, the ruleset did not satisfy the target controls. The verifier therefore correctly fails closed. Repository documents must not describe the live ruleset as hardened until GitHub Administration reflects the target state.

The `execution` branch must likewise be verified through GitHub's live protection/ruleset APIs before being treated as protected. Absence of a repository-side assertion is not proof of protection.

## Open Agent Execution Mode

Authorized agents may implement, test, harden, document, and coordinate broadly on the canonical `execution` lane. This does not grant merge, promotion, certification, self-approval, or governance-bypass authority.

## Evidence rule

Any mutation to `execution` creates a new candidate SHA and invalidates prior SHA-specific evidence. Pending, skipped, cancelled, neutral, stale, or mismatched evidence is not PASS.

## Certification state

Final certification remains `NOT READY` until:
- exact-SHA technical/security/browser/Red-Team evidence is current;
- Prompt 18 freeze and Prompt 19 evidence are satisfied;
- live GitHub governance satisfies the target policy;
- legitimate approval/promotion conditions are satisfied;
- post-merge identity and production verification pass where applicable.

No documentation mutation may be used to convert a live governance blocker into a certification PASS.


## Governance Modes
Development uses FAST governance to minimize agent latency while preserving exact-SHA, security, privacy, and production-boundary controls. Final certification uses STRICT governance and does not inherit development shortcuts. A FAST pass is never a certification pass.
