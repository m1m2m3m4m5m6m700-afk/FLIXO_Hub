# Pull Request Reconciliation Evidence

- Task: `EXEC-PR-RECONCILE-001`
- Audit target branch: `execution`
- Exact audit SHA: `59b85cce939289f2eb88037f8721688a95abce0a`
- Observation date: 2026-10-10 (live GitHub API state)
- Scope: read-only PR/branch/check-run reconciliation. No merge, deployment, ruleset mutation, or `main` mutation was performed.

## Canonical lineage

The GitHub `execution` branch points to the audit SHA above. Current `main` is `1bc688c7fc4e8e6711ce024c8004539c4340edd1`. Comparing current `main` to `execution` reports a diverged history: `execution` is 2,198 commits ahead and 6 commits behind, with merge base `de1e5b3c46bc1f5812987cb8ad863c5ff983178d`. PR #1214 therefore is not currently mergeable. The six-commit base drift must be reconciled through a protected candidate branch/PR, not by directly mutating `main` or force-pushing `execution`.

## Open candidate PR inventory

| PR | Head → base | Head SHA | GitHub mergeability | Check evidence | Classification |
|---|---|---|---|---|---|
| [#1214](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1214) | `execution` → `main` | `59b85cce939289f2eb88037f8721688a95abce0a` | Not mergeable | Failed `Typecheck, lint, core contracts, build`; failed agent self-learning evaluation; failed `trust-gate`; failed Exact-SHA promotion proof; Red Team and Runtime Assurance cancelled. | Canonical integration PR, blocked. Do not promote. |
| [#1217](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1217) | `call/full-protocol-20261007` → `execution` | `2c80ccb335b57724ad443ad163acdadb016647b1` | Not mergeable | Four failed checks, including gate, Agent-3 triage, and call-agent tests. | Stale/conflicting candidate; do not merge until rebased and independently reverified. |
| [#1224](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1224) | `call/closure-hardening-context-20261008-r3` → `execution` | `88b962c9d4479414f2839752f067d5dc0a1a54bb` | Mergeable according to GitHub | Agent-3 mandatory triage failed; two other checks skipped. | Not merge-ready despite conflict-free status. |
| [#1237](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1237) | `fix/ledger-active-count-26` → `execution` | `e0ee3c829bd21a84b1fa6279de82caafdf07f49d` | Not mergeable | Agent-3 mandatory triage failed; two checks skipped. | Supersession/ledger reconciliation required before considering merge. |
| [#1250](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1250) | `chore/oss-1-legal` → `main` | `66a87b69c51469e8c4848ce8d31cc375c953de0d` | Not mergeable | `trust-gate` and `Typecheck, lint, core contracts, build` failed. | Blocked OSS candidate; keep separate from execution integration. |
| [#1270](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1270) | `fix/knowledge-snapshot-large-blobs-20261008` → `main` | `527f92ecec0d0b31b46318ef4bb769badbf118b5` | Mergeable according to GitHub | 8 successful checks, 8 skipped, no failed check-runs in the inspected result. | Cleanest candidate by current check evidence; still requires independent review and correct promotion path. Not merged by this audit. |
| [#1213](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1213) | `agent-learning/public-repo-acquisition-20261007-v2` → `execution` | `52c475b8c5206fc1ad2d2ca872f7dc47f86777f2` | Not mergeable | No current passing-check evidence was established in this audit. | Hold; refresh candidate lineage and checks before classification can be upgraded. |

## Decision

- `execution` remains the canonical integration base; no duplicate candidate is promoted by this report.
- No open PR is merged by this audit. GitHub's `mergeable=true` is only a conflict-status signal, not proof that required checks, policy, or certification gates passed.
- PR #1214 cannot be promoted while it is six commits behind current `main` and its exact-SHA trust/promotion/core checks fail.
- PR #1270 is a separate, narrowly scoped candidate and must not be treated as resolving the broader #1214 release blockers.
- Release certification and promotion remain blocked until the canonical execution candidate has current exact-SHA technical, security, browser, governance, and deployment evidence.

## Reproducibility references

- [PR #1214 checks](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1214/checks)
- [PR #1217 checks](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1217/checks)
- [PR #1224 checks](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1224/checks)
- [PR #1237 checks](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1237/checks)
- [PR #1250 checks](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1250/checks)
- [PR #1270 checks](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1270/checks)
