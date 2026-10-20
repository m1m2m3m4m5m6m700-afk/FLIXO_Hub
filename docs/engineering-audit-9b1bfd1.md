# Engineering Audit — Reconstructed 2026-10-20

> **Provenance warning:** This is a newly reconstructed engineering audit, not a recovered historical report. The originally requested path was not found in the target branch or the checked release/evidence refs. This file does not claim to be historical and is not a deployment certificate.

## Scope and identity

- Repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- Branch baseline reviewed: `agent/phase0-remediation-20261019`
- Baseline commit: `9b1bfd16b7d485d72df5520076053529e7c75162`
- Baseline message: `build: prefer exact deployment SHA for generated stats`
- Pull request: [#1341](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1341), open, base `main`, 12 changed files at the time of the baseline review.
- Main protection: [FLIXO-MAIN-PROTECTION](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/rules/23854302), active; requires a review, code-owner review, `trust-gate`, and `Exact-SHA promotion proof`.

## Evidence links

- [Baseline manual CI run #39306207913](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39306207913)
- [Baseline CI workflow](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/blob/9b1bfd16b7d485d72df5520076053529e7c75162/.github/workflows/ci.yml)
- [Baseline branch](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/tree/9b1bfd16b7d485d72df5520076053529e7c75162)
- [Model license manifest](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/blob/9b1bfd16b7d485d72df5520076053529e7c75162/docs/MODEL_LICENSE_MANIFEST.json)
- [CODEOWNERS](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/blob/9b1bfd16b7d485d72df5520076053529e7c75162/.github/CODEOWNERS)

## Findings on baseline SHA

### P0 — Deployment workflow authority policy failed

Run #39306207913 failed its Branch policy job with:

```text
BRANCH_POLICY=FAIL
Unauthorized workflow authority:
.github/workflows/ci.yml#preview-deployment:
production/deployment authority is not gated to a push of refs/heads/main.
```

The same run's `trust-gate` failed because `BRANCH_RESULT=failure`. The exact-SHA promotion proof and preview/production deployment jobs were skipped in that workflow-dispatch run. This is a baseline finding; this document does not claim the follow-up remediation has passed CI.

### P1 — Home theme model did not match the requested system behavior

At the baseline, `OfficialHome.tsx` defined `light | night | black`, rendered `Cloud` for the night/gray option, and had no `prefers-color-scheme` listener. The Cloud icon was in active JSX and could not safely be deleted without changing the usage. The corresponding CSS had separate `light`, `night`, and `black` data-theme selectors.

### P1 — Statistics generator suppressed one directory-read failure

At the baseline, the per-tool lookup used `readdir(dir).catch(() => [])`. The recursive build-output walker returned an empty list for `ENOENT` without logging. The SHA fallback could yield `unknown` rather than failing. The payload did not contain `generatedAt` or the suspected hard-coded `Math.max` fallback.

### P1 — Model licensing remained blocked

The baseline `docs/MODEL_LICENSE_MANIFEST.json` had an empty `entries` array. A repository or deployment SHA is not a model-artifact fingerprint and cannot replace model provenance or license approval. The root `LICENSE` path returned 404 through the Contents API on this baseline; repository metadata reported no detected license.

### P2 — Audit scope and generated files

The baseline CI log reported `npm audit --omit=dev --audit-level=high` finding zero vulnerabilities. A full audit including development dependencies was not established by that run and was not executed while producing this report. The build log reported 14 categories, 24 mapped tools, 10 executable tools, 20 locales, and 220 localized sitemap URLs. The `__flixo-stats.json` build outputs were not committed files in the baseline source tree.

## Evidence-document search provenance

The requested original audit/readiness filenames were not located in:
- `agent/phase0-remediation-20261019` at the baseline SHA;
- `main`;
- selected release/evidence refs including `agent/EXEC-LEAD-OFFICIAL-RELEASE-CERTIFICATION-001-current-evidence-20261018`, `agent/EXEC-LEAD-OFFICIAL-RELEASE-CERTIFICATION-001-blocker-reconcile-20261018`, `agent/EXEC-LEAD-RELEASE-BLOCKERS-20261015`, `agent/EXEC-RELEASE-BLOCKERS-EVIDENCE-20261015`, `chore/release-readiness-plan-20261015`, and `chore/release-readiness-plan-refresh-20261015`;
- exact-path history queries for the requested filenames and GitHub code search for `engineering-audit`.

This is a bounded search, not proof that the files never existed in any repository ref. The document is labeled reconstructed accordingly.

## Conclusion

**Baseline disposition: BLOCKED_WITH_EVIDENCE.** Successful typecheck/build, browser smoke, coverage, and red-team jobs in run #39306207913 did not override the failed branch-policy/trust gates. No production deployment, release certification, or licensing approval is asserted here.
