# CELL — COMMIT ATTRIBUTION BASELINE

Status: ACTIVE ENFORCEMENT BASELINE
BASELINE_SHA: 755f958d4ccac15357c95f3e338dfa4fa7d509d7

## Reconciliation record — 2026-10-14

The prior ratchet at `3f1cf5ec3cbdeac4aea9dad7c1ccd036bf0448da` began before the legacy execution-ecosystem ledger bootstrap had finished. Strict CI on candidate `2520d885568e5047334f1c6dfb4893161ddf41a0` reported the bootstrap commit `755f958d4ccac15357c95f3e338dfa4fa7d509d7` as a CELL-scoped commit without a TASK_ID. The bootstrap commit is dated 2026-10-11T05:11:44Z and introduces the fixed task-card schema, canonical dispatch ledger, and execution-agent contracts.

To preserve immutable Git history and make the enforcement boundary match the documented reconciliation, the baseline is reset to that exact bootstrap commit. This deliberately treats the 16-commit range from the former baseline through this commit as historical bootstrap, rather than claiming only one commit is excluded. The prior CI run had found no other attribution violations in that range. This is a one-time cutover-boundary reconciliation, not a per-path or per-rule bypass.

## Enforcement from this baseline

- Git history is preserved; no rewrite, force-push, or deletion is part of this reconciliation.
- The attribution checker validates every non-merge commit strictly after `BASELINE_SHA` through the exact candidate HEAD when its changed files match the CELL hard-control path contract.
- Every post-baseline CELL commit must contain a canonical EXEC task ID in its commit message. The checker remains fail-closed for missing or unknown task IDs.
- No Gitleaks finding is suppressed by this baseline, and no product, security, browser, model-admission, or deployment gate is changed by it.
- Evidence must be rerun and tied to the resulting exact SHA.

CI enforcement: `scripts/ci/cell-commit-attribution.mjs`.

Governance references: `EXEC-PR-RECONCILE-001` and `EXEC-AGENT-SELF-LEARNING-001`.
