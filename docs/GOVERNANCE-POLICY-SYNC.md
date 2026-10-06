# FLIXO Governance Policy Synchronization

STATUS: POLICY-ALIGNED / LIVE ENFORCEMENT PENDING

## Purpose

This document reconciles three different authorities without conflating them:

1. Agent execution contract — what authorized agents may implement on `execution`.
2. Live GitHub governance — rulesets and branch protection enforced by GitHub.
3. Release certification — exact-SHA evidence plus required governance and human promotion conditions.

Repository text cannot mutate or simulate GitHub Administration state.

## Canonical repository policy

- Canonical implementation lane: `execution`.
- Production truth: `main`.
- Integration path: `execution -> main`.
- Agents may work broadly on `execution` under Open Agent Execution Mode.
- No third production/integration lane.
- No agent self-certification, self-approval, merge/promotion, or governance bypass.
- Every mutation is non-force and race-safe; moving HEAD invalidates SHA-specific evidence.
- Required checks remain fail-closed.

## Live GitHub governance target

`FLIXO-MAIN-PROTECTION` must enforce:

| Control | Required |
|---|---:|
| approving reviews | 1 |
| dismiss stale approvals on push | true |
| Code Owner review | true |
| latest-push independent approval | true |
| review-thread resolution | true |
| strict required status checks | true |
| required check: `trust-gate` | yes |
| required check: `Exact-SHA promotion proof` | yes |

## Observed live state at policy reconciliation

Ruleset ID: `23854302`
Target: `refs/heads/main`
Enforcement: `active`

Observed values before this policy-alignment commit:
- approving reviews: 0
- dismiss stale approvals: false
- Code Owner review: false
- latest-push approval: false
- review-thread resolution: false
- strict required status checks: false
- required checks: `trust-gate`, `Exact-SHA promotion proof`

Therefore the live state is a governance blocker, not a repository-documentation defect.

## Execution branch protection

The `execution` branch must be verified through GitHub live protection/ruleset APIs before being treated as protected. A repository-side contract or CI assertion is not sufficient proof.

## Conflict-resolution rule

When repository policy text and live GitHub enforcement disagree:

1. Keep the stronger assurance requirement as the target policy.
2. Report the live mismatch explicitly.
3. Do not weaken `verify-main-ruleset`, `Branch Policy`, `trust-gate`, or promotion proof to make the mismatch disappear.
4. After live GitHub administration is corrected, rerun the required checks on the current exact SHA.
5. Any mutation to `execution` invalidates prior exact-SHA evidence.

## Certification rule

Only the Certification/Release authority may declare a release certified. Open Agent Execution Mode changes implementation freedom, not certification authority.


## Agent Fast Path / Release Strict Path
The control plane has two explicit modes:

| Mode | Purpose | Agent friction | Release assurance |
|---|---|---|---|
| FAST | Routine implementation, repair, testing, experimentation | No fixed operation count, no mandatory handoff/lease, worker branches allowed, no routine approval | Not a certification authority |
| STRICT | Release candidate, production promotion, final certification | Used only when release assurance is requested | Exact-SHA + live governance + required approval conditions |

FAST mode never grants direct `main` mutation, certification, or production deployment authority. STRICT remains the release closure mode.
