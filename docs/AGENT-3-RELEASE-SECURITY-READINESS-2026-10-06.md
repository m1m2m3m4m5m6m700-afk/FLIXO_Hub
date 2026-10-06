# Agent 3 Release/Security Lane — Readiness Record — 2026-10-06

## Lane ownership

Agent 3 owns the QA / security / red-team / release surfaces defined by the unified execution plan:

- `.github/**`
- `scripts/**`
- `docs/**`
- release/security test harnesses
- exact-SHA evidence and CI/CD controls

UX/browser implementation remains an Agent 2 surface. The branch `agent-3/release-security-20261006` is the clean Agent 3 integration lane; the legacy `agent3/ux-browser-20261006` name is not the Agent 3 ownership lane in the V3 plan.

## Reconciled governance files

- `.github/CODEOWNERS` now protects the actual agent profile path `/.github/agents/`.
- `tests/security-governance.test.ts` asserts the same real path and rejects the obsolete `/docs/security.md` entry.

## Required Agent 3 closure gates

1. Current exact `execution` SHA and PR lineage.
2. CI workflow graph and branch policy.
3. CodeQL, secret scan, dependency/security audit.
4. Red-team/adversarial regression.
5. Coverage and browser evidence.
6. Release checklist / exact-SHA identity.
7. Production identity and post-merge evidence when applicable.
8. Documentation authority alignment.
9. Final recheck after every SHA change.

## Current external blocker seen in the repository

The repository currently contains a legacy branch named `agent3/ux-browser-20261006`, which violates the repository's branch-policy naming rule. A clean permitted mirror now exists as `agent-3/ux-browser-20261006`. The legacy branch still requires owner-side deletion or retirement; this record does not claim that deletion has happened.

A separate `agent-4/qa-video-render-20261006` branch is also present and is outside the allowed Agent 1/2/3 naming policy; it should be retired or explicitly governed before a final release claim.

## Rule

Do not turn this record into certification evidence. Final Agent 3 closure requires fresh exact-SHA CI evidence on the candidate lineage and a clean governance state.
