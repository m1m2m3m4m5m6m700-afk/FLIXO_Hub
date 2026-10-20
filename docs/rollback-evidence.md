# Rollback and Release Attempt Evidence

**Assessment date:** 2026-10-20  
**Policy:** rollback authority applies to `execution` only. `main` must never be force-pushed or rolled back by this procedure.

## Backups created

- `backup/80percent-1a6ff66-2026-10-20` points to the preserved candidate SHA `1a6ff6602f716cf828c3427715d7e0a4f284c1e1`.
- `backup/pre-100percent-391ba665-2026-10-20` points to the execution head before this 100% attempt, `391ba6651e14ac31bcc0184620d9add60c6694d6`.

## Rollbacks performed

- **None so far.** No CI failure has required reverting or restoring `execution`. No force-push has been performed. `main` has not been modified.

## Baseline state

- Baseline candidate SHA: `1a6ff6602f716cf828c3427715d7e0a4f284c1e1`; canonical CI run [39437647112](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39437647112) completed successfully.
- Execution head before this attempt: `391ba6651e14ac31bcc0184620d9add60c6694d6` (candidate evidence documentation commit; separate CI was queued at last observation).
- Production `main` baseline: `29f2e0fe045689337a1483ed98d087b736ff6afc`.
- PR [#1308](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1308) remains open and blocked by required review/governance and legal/provenance/deployment evidence. A chat authorization is not a GitHub review event.

## 100% attempt status at log creation

- Preview workflow publication: proposed through a separate PR from a branch based on `main`; not yet merged and no preview deployment has been claimed.
- Preview deployment HTTP 200 / exact-SHA provenance: not verified yet.
- Model license manifest: `entries: []`; model-free profile does not establish code-license rights or third-party provenance, so the manifest will not be changed to claim false licensing evidence.
- Production deployment and `v1.0.0-rc.1` tag: not performed.
- Current status: `BLOCKED_WITH_EVIDENCE`; candidate readiness remains an estimate, not 100% certification.

## Evidence update rule

Update this file with each actual rollback's reason, previous SHA, resulting SHA, and associated CI run. Do not log a rollback unless it was actually performed. Do not claim successful deployment, review approval, or a release tag without direct evidence.

## Update: preview workflow publication attempt

- Created backup `backup/pre-preview-pr-1347-2026-10-20` at `e46ee8ab417be49ee52c3f5e90f4dce3e6b7cf41`.
- Opened [PR #1347](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1347) to publish only `.github/workflows/ui-preview.yml` from a branch based on protected `main`.
- PR #1347 is open, not merged. It requires normal CI and required independent review. No branch-protection bypass was attempted.
- Because the workflow is not yet present on the default branch and no workflow-dispatch action is available through the connected GitHub integration, no preview workflow was dispatched. No preview HTTP status or deployed SHA is claimed.
- Execution evidence-log update begins from `e46ee8ab417be49ee52c3f5e90f4dce3e6b7cf41`; the resulting commit SHA will be different and needs its own CI.
- No rollback performed; `main` remains untouched at `29f2e0fe045689337a1483ed98d087b736ff6afc`.
