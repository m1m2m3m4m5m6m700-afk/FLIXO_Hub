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

## Latest verification refresh — 2026-10-18

- Latest integration head recorded by the canonical promotion PR: `7a207b485dea71604b258a25940deb997ae330cf`. Exact-head FLIXO CI passed: [run 39153533853](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39153533853); governance contract [run 39153533956](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39153533956) and CALL lab gate [run 39153533855](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39153533855) also passed.
- Earlier license metadata PR [#1339](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1339) proposed aligning `CITATION.cff` to the existing AGPL-3.0-only declaration, but its branch is stale relative to current `execution` (2 commits ahead and 9 behind at last comparison). The current execution-based candidate carries the scoped metadata alignment; its CI and review must be assessed on the exact new SHA. Neither the old CI run nor metadata alignment closes copyright provenance, bundled asset/dependency notices, or distribution obligations.
- Offline package PR [#1331](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1331) remains open and its head is behind current `execution`; its older green run is not evidence for the current candidate. Revalidate it against a current base before relying on its package.
- Vercel inspection found a READY deployment at commit `ed4cdc9daf87b7b6f7677a9198a00ca38b29a814`, not the current candidate. The project reports SSO protection enabled for all deployment types except custom domains. No public deployment or post-deployment smoke receipt for the current candidate was verified.
- PR [#1308](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1308) has no submitted review events at the latest review query. The required protected review cannot be replaced by conversational authorization.

**Current decision remains `BLOCKED_WITH_EVIDENCE`.** Keep `main` unchanged until the required live review and exact-SHA checks pass, legal provenance is evidenced, and a production deployment for the approved SHA has a verified identity and post-deployment smoke receipt.

## Remaining release blockers

1. **Code-license and rights provenance:** this candidate aligns `CITATION.cff` with the existing root AGPL-3.0-only license text and `package.json` declaration. The earlier Apache-2.0 target remains unverified and is not treated as authorization to relicense contributions or third-party materials. Full copyright provenance, dependency/bundled-asset notices, and applicable AGPL distribution/network-use obligations remain unresolved. See `docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md` and PR [#1323](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1323). Do not assert full legal clearance until rights/provenance evidence is recorded.
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

Repository automation cannot fabricate or self-approve missing external evidence. Before public launch, obtain the required independent reviewer approval on the current release lineage; verify the actual merge checks remain green; and close the public support contact, private vulnerability reporting, privacy/consent requirements, and external analytics/Search Console ownership actions required by the public launch checklist. `CITATION.cff` is being aligned to the existing AGPL-3.0-only license declaration; this does not authorize the previously recorded Apache target or certify the copyright chain, dependency/asset notices, or AGPL distribution/network-use obligations. These remain explicitly blocked until evidence is recorded. The ruleset configuration itself was verified as noted above.

## Non-negotiable rules

- No direct edits or pushes to `main`; no force-push, history rewriting, or deleting files as a shortcut.
- No model admission, license exception, or external-provider dependency is implied by the model-free profile.
- Evidence is valid only for the exact SHA and workflow run that produced it. Any candidate mutation invalidates candidate-specific evidence until rerun.
- Agents do not merge/promote to `main` or self-certify.
- Final state is `CERTIFIED` only with complete evidence; otherwise `BLOCKED_WITH_EVIDENCE`.
