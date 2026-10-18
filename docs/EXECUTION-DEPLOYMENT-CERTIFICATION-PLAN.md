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

## Current candidate and exact-SHA evidence

- Current integration candidate: `47be48c1bccdc282f85e45fe3e6371f6914b48be`.
- Implementation PR #1335 was merged into `execution` at that exact merge commit on 2026-10-18. Production `main` has not been changed; its observed SHA remains `29f2e0fe045689337a1483ed98d087b736ff6afc`.
- Canonical protected promotion PR: [#1308](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1308), source `execution`, target `main`; it is open and not merged.
- [Execution push CI run 39145752548](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145752548) completed successfully on the merge SHA, including `npm test`, build, production dependency audit, CodeQL, secret scan, Red Team, branch policy, exact-SHA internal coverage, Hub Stage 1, Chromium smoke, `trust-gate`, and exact-SHA promotion proof. Production deployment was skipped because this was a push to `execution`, not a push to protected `main`.
- [Main promotion PR CI run 39145757343](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145757343) completed with failure on the same SHA. Model-free profile admission, branch policy, Red Team, secret scan, agent watchdog, CodeQL, build/tests, Hub Stage 1, coverage, sensitive-path assurance, Chromium, and `trust-gate` passed. `Exact-SHA promotion proof` failed because its wait step searched the Actions API for separate workflow runs named `FLIXO CodeQL` and `FLIXO Secret Scan`; the exact-head CodeQL and Secret Scan results are jobs within the same `FLIXO CI` run, so the workflow-run query incorrectly returned `MISSING`. A proposed fix makes promotion proof depend directly on the successful exact-head `codeql` and `secret-scan` job results, and adds regression coverage.
- Additional successful evidence on the merge SHA: [TestSprite Live E2E](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145752450), [clean-clone Red Team](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145752431), and [Governance Contract](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145757224).
- The first [Autonomous Promotion Controller run 39145752543](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145752543) failed because its `GITHUB_TOKEN` could not call `enablePullRequestAutoMerge`. The controller is being corrected to report the protected review/check state without attempting a merge or enabling auto-merge. No merge to `main` resulted from that failure.
- Live `main` ruleset configuration was verified read-only: `FLIXO-MAIN-PROTECTION` (ID `23854302`) is active and requires one approving review, Code Owner review, latest-push approval, resolved review threads, strict `trust-gate`, and `Exact-SHA promotion proof`, with no bypass actors. The owner stated in this conversation that review was completed, but the live GitHub review API returned zero review submissions on PR #1308 at last check. The protected merge gate therefore must remain authoritative until the required GitHub approval is recorded.

## Remaining release blockers

1. **Code-license and rights provenance:** root `LICENSE` contains AGPL-3.0 text while `CITATION.cff` declares Apache-2.0. The requested Apache target is documented, but authority to relicense all covered contributions and third-party materials is not evidenced. See `docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md` and PR [#1323](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1323). Do not assert legal clearance until rights/provenance evidence is recorded.
2. **Protected approval:** PR #1308 still needs the actual required GitHub review controls to be satisfied on its current head SHA.
3. **Production identity:** no production deployment ID, deployed immutable identity, or post-deployment smoke/provenance receipt exists for this candidate. That job is correctly not run before an authorized merge to `main`.
4. **Owner-side launch checks:** real support contact, private vulnerability reporting, privacy/consent requirements, Search Console/domain ownership, analytics configuration, and rollback drill require verifiable owner-account evidence.
5. **Controller boundary:** eliminate the failed auto-merge mutation attempt while preserving the live protected review/check requirements; do not bypass GitHub permission or branch-protection errors.

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
