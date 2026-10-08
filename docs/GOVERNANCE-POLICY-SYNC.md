# FLIXO Governance Policy Synchronization

STATUS: AUTONOMOUS-MERGE / AUTOMATED-GATES

## Purpose

This document separates execution freedom from the automated controls that must remain true at merge time.

1. Agent execution contract defines what authorized agents may implement on `execution`.
2. Live GitHub governance defines what GitHub enforces on `main`.
3. Merge reporting records the exact merged SHA after successful promotion.

Repository text does not simulate GitHub administration state.

## Canonical repository policy

- Canonical implementation lane: `execution`.
- Production truth: `main`.
- Integration path: `execution -> main` through a protected pull request.
- Authorized agents may implement, test, repair, coordinate, and merge without human approval.
- No direct `main` ref mutation.
- Automated checks remain fail-closed.
- Every mutation and every merge claim is bound to an exact SHA.
- Post-merge reporting is observational and does not create a second approval authority.

## Autonomous merge profile

| Control | Required |
|---|---:|
| approving reviews | 0 |
| dismiss stale approvals | false |
| Code Owner review | false |
| latest-push approval | false |
| review-thread resolution | false |
| strict required status checks | false |
| required check: `trust-gate` | yes |
| required check: `Exact-SHA promotion proof` | yes |

Human approval is not a merge prerequisite. The required status checks are the merge gate.

## Live ruleset

Ruleset: `FLIXO-MAIN-PROTECTION`  
ID: `23854302`  
Target: `refs/heads/main`  
Enforcement: `active`

The available GitHub connector exposes read-only ruleset administration, so live settings must be verified from GitHub. Repository-side policy files cannot change those settings.

## Merge protocol

1. Agents publish changes to `execution` using non-force, race-safe mutation.
2. CI runs against the exact candidate SHA.
3. The protected PR may merge automatically once required checks pass.
4. No human review or approval is required.
5. After merge, the post-merge report records source SHA, merge SHA, base SHA, checks, actor, and change summary.

A moving `execution` HEAD invalidates older SHA-specific evidence.

## Certification language

Do not label the merge report as a human certification. It is an exact-SHA automated integration record. Production deployment and production identity verification remain separate downstream facts.
