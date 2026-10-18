# FLIXO Hub Execution, Deployment, and Certification Plan

**Status:** `BLOCKED_WITH_EVIDENCE`  
**Mission:** `EXEC-LEAD-OFFICIAL-RELEASE-CERTIFICATION-001`  
**Repository:** `m1m2m3m4m5m6m700-afk/FLIXO_Hub`  
**Integration branch:** `execution`  
**Production branch:** `main`  
**Release profile:** `MODEL_FREE_INITIAL_RELEASE`

This is an operational plan and evidence index, not a deployment certificate. A green worker-branch CI run does not mean that the candidate has been promoted or deployed.

## Product scope

The owner-selected initial release operates without a model. Model runtime and external inference are disabled; model-dependent capabilities must be unavailable or clearly marked unavailable. The AI Image Generator route explicitly displays the model-free limitation, and the browser test asserts that opening the route makes no `/api/ai/image` request. The strict model-backed admission path remains fail-closed and is not waived by this profile.

## Last fully green verification baseline

The following runs completed successfully against predecessor candidate SHA `3da681e301d67b099d3b98455910c63cbe4d9ac6` on 2026-10-18:

- Push CI: [run 39143708404](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39143708404)
- Pull-request CI: [run 39143712503](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39143712503)

Both runs passed build/typecheck/lint and `npm test`, production dependency audit, CodeQL, secret scan, Red Team, branch policy, agent watchdog, sensitive-path assurance, exact-SHA coverage, Hub Stage 1, Chromium browser smoke, and `trust-gate`. The model-free profile and strict model-backed behavior are covered by the model-license-gate regression tests in the test suite.

**Evidence boundary:** this plan is a new repository mutation after those runs, so those runs are predecessor-SHA evidence only. The resulting plan commit must receive fresh exact-SHA CI, security, coverage, and browser evidence before it can be treated as a verified candidate.

## Current promotion and deployment state

- PR #1335 is a draft PR from the model-free feature branch to `execution`; it is not merged.
- The successful runs above skipped exact-SHA promotion proof and production deployment because the event was not a promotion PR from `execution` to `main` or a push to `main`. Skipped is not pass.
- No new production deployment ID, deployed commit SHA, immutable production identity, or post-deployment smoke receipt has been established by these runs.
- The public release manifest and final certification documents remain templates marked not certified.
- Live `main` ruleset configuration was verified read-only on 2026-10-18: `FLIXO-MAIN-PROTECTION` (ID `23854302`) is active, targets `refs/heads/main`, requires one approving review, Code Owner review, latest-push approval, review-thread resolution, strict `trust-gate` and `Exact-SHA promotion proof` checks, and has no bypass actors. Snapshot: https://api.github.com/repos/m1m2m3m4m5m6m700-afk/FLIXO_Hub/rulesets/23854302. Required independent review/approval of the current release lineage is still outstanding.

## Required closure sequence

1. Re-run all required workflows on the exact latest candidate SHA after this plan is committed. Resolve every failure with a narrow code or test fix; do not weaken gates.
2. Review the full capability inventory against the model-free product profile. Keep model-dependent routes unavailable and verify no user content is silently sent to an inference provider.
3. Complete required independent review and live GitHub governance checks. Preserve the protected `execution -> main` promotion path and do not write directly to `main`.
4. Merge PR #1335 to `execution` only through the repository-authorized review and merge process after all required checks are green.
5. Verify the exact current `execution` SHA and open/validate the authorized promotion PR from `execution` to `main`. Require current checks, fresh approvals, resolved review threads, CodeQL, secret scan, and successful model-free profile admission.
6. After authorized promotion and merge, verify the main-commit SHA, wait for the production exact-SHA deployment workflow, and capture its deployment ID and immutable production identity.
7. Run and retain post-deployment browser/smoke checks against the canonical production origin. Verify deployed SHA equals the intended release SHA and confirm `/api/*` fails closed as designed for the static Worker.
8. Update the release manifest and certification record with exact SHAs, workflow runs, receipts, production identity, release tag, timestamp, and independent approval. Issue `CERTIFIED` only if every mandatory gate is evidenced; otherwise retain `BLOCKED_WITH_EVIDENCE`.

## External or governance blockers

Repository automation cannot fabricate or self-approve missing external evidence. Before public launch, obtain the required independent reviewer approval on the current release lineage; verify the actual merge checks remain green; and close the public support contact, private vulnerability reporting, privacy/consent requirements, and external analytics/Search Console ownership actions required by the public launch checklist. The root `LICENSE` currently contains AGPL-3.0 while the recorded target decision is Apache-2.0; this rights/provenance conflict is documented in `docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md` and must be resolved by the rights owner before license claims or file changes. The ruleset configuration itself was verified as noted above. Record each remaining item as verified with evidence or leave it explicitly blocked.

## Non-negotiable rules

- No direct edits or pushes to `main`; no force-push, history rewriting, or deleting files as a shortcut.
- No model admission, license exception, or external-provider dependency is implied by the model-free profile.
- Evidence is valid only for the exact SHA and workflow run that produced it. Any candidate mutation invalidates candidate-specific evidence until rerun.
- Agents do not merge/promote to `main` or self-certify.
- Final state is `CERTIFIED` only with complete evidence; otherwise `BLOCKED_WITH_EVIDENCE`.
