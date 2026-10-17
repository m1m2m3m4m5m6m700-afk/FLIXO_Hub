# FLIXO Legal / External Launch Blockers

This ledger distinguishes repository changes from external/legal evidence. A documentation or metadata change must not be represented as proof of ownership, contributor consent, or completion of an external account action.

## Repository code license

**Decision recorded: Apache-2.0**, selected by the repository owner in the project conversation on 2026-10-15.

The proposed integration branch aligns the canonical `LICENSE` text, `package.json` license metadata, `CITATION.cff`, and README disclosure to Apache-2.0. No additional “Powered by FLIXO Hub” condition is added; Apache-2.0 remains the selected license without a custom network-attribution clause.

**Still required before declaring the legal blocker fully closed:**
- Review copyright ownership and contribution provenance for the code and documentation covered by the repository-wide license statement.
- Identify third-party files and dependencies with separate license terms, and retain required notices.
- Confirm any contributor/employer rights or permissions needed for material not owned by the person selecting the license.
- Review the proposed change and its exact commit in the protected PR workflow; do not infer legal sufficiency from matching metadata alone.

The license decision and repository-file reconciliation are recorded, but these outstanding rights/provenance checks are not claimed complete by this file.

## Public support contact

A real support contact must be configured before launch. Never publish a fabricated email address or identity.

## Private security reporting

GitHub private vulnerability reporting/security-advisory capability must be enabled and tested before public launch.

## Search Console / analytics

External ownership verification, Search Console registration, sitemap submission, analytics provider configuration and legal consent requirements must be completed in the relevant external accounts.

## Distribution accounts

Product Hunt, Hacker News, Reddit, X, LinkedIn, YouTube and email delivery require account-level actions. Repository automation can prepare content and runbooks but cannot treat those external actions as completed without evidence.


## Exact-SHA release gate reconciliation — 2026-10-15

Latest verified CI run inspected: [run 38765921643](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38765921643), candidate SHA `d9a582635f461f97760e9f86a13f59e654ae00b8`.

Successful jobs on that SHA:
- Typecheck, lint, core contracts, build, `npm test`, production dependency audit, dependency license metadata inventory.
- Secret scan, CodeQL, red-team adversarial regression, Agent Watchdog security integration.
- Exact-SHA internal coverage, Hub Stage 1 exact-SHA contract, trust-gate, sensitive-path automated assurance.
- Chromium browser smoke.

Release blockers still open on that evidence:
- `Production model admission (strict release mode)`: SKIPPED.
- `Exact-SHA promotion proof`: SKIPPED.
- `Production exact-SHA deployment`: SKIPPED.
- The PR has no formal submitted review recorded at the last review-list check.
- The model manifest has `entries: []`. A model is not admitted merely because the non-strict model-license test passes.
- The legal provenance register marks owner-created work, historical contributions, employer/contractor rights, third-party assets, license compatibility and notices, bundled assets, and distributed artifact verification as not verified or pending.
- The dependency inventory's successful metadata check is not a compatibility/legal clearance. Explicit triage remains for `jszip@3.10.1` (`MIT OR GPL-3.0-or-later`), MPL-2.0 `lightningcss` packages and whether they ship, and `isbot@5.2.1` (`Unlicense`).

## Required closure evidence

1. Record the exact production model and deployment mode; pin immutable model files; compute reproducible SHA-256 hashes of the actual artifacts; archive the applicable license, model card, acceptable-use and redistribution/fine-tuning/distillation/trademark terms; document provenance and security evaluation. Do not substitute an upstream revision identifier for artifact hashes.
2. Complete file-level copyright and contribution provenance review, including employer/contractor rights where applicable, copied/vendor assets, third-party notices and shipped bundles. Record evidence and an independent reviewer; do not infer consent or ownership from repository access.
3. Resolve the named dependency license questions from upstream license texts and the actual production bundle, retaining required notices.
4. Obtain an independent review on the PR. Automated CI is not a human review.
5. Re-run all required gates after the final candidate SHA is established. Promotion proof and production deployment must run, not be skipped, and must attest to that exact SHA and the resulting live artifact.

This record documents verified states and closure requirements. It does not claim that legal rights, model admission, promotion, or deployment are complete.

## Follow-up: exact-SHA CI and dependency inventory review — 2026-10-15

Candidate commit: `0cecc6f61ff62cd258670b9cc3c60e0ad5723a6c`.
CI run: https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38767226191
Dependency inventory artifact: `flixo-dependency-license-inventory-38767226191`, artifact ID `11990246939`, GitHub artifact digest `sha256:58de3b711277292e576ec8fe4fee443761858af580f7f5437e298979ea0f5aff`.

At the latest re-check, the following jobs completed successfully on this exact candidate SHA: typecheck/lint/core contracts/build, npm test, production dependency audit, dependency license metadata inventory, CodeQL, secret scan, red-team regression, Agent Watchdog security integration, Hub Stage 1 exact-SHA contract, sensitive-path automated assurance, and exact-SHA internal coverage. Chromium browser smoke was still in progress at the last check. Production model admission remained SKIPPED because this pull request targets `execution`, not `main`; this is not a PASS. No formal PR review was present in the review list.

The downloaded exact-SHA dependency inventory contains 262 package entries, 0 unresolved license metadata entries, 1 ignored workspace link, and 1 ignored extraneous lock entry. The following package records are present:
- `jszip@3.10.1`: `(MIT OR GPL-3.0-or-later)`, production dependency, integrity `sha512-xXDvecyTpGLrqFrvkrUSoxxfJI5AH7U8zxxtVclpsUtMCq4JQ290LY8AW5c7Ggnr/Y/oK+bQMbqK2qmtk3pN4g==`. Upstream states it is dual-licensed and can be used under MIT or GPLv3: https://github.com/Stuk/jszip . Still verify the exact npm archive's license text and preserve the MIT notice in the shipped artifact if that option is selected.
- `lightningcss@1.33.0` and `lightningcss-linux-x64-gnu@1.33.0`: MPL-2.0, marked development-only in the lockfile. Upstream package metadata declares MPL-2.0: https://github.com/parcel-bundler/lightningcss/blob/master/package.json . Actual shipped bundle inclusion and required notices remain to be checked.
- `isbot@5.2.1`: Unlicense, marked production dependency, integrity `sha512-dJ+LpKyClQZ7NG+j3OensC/mAZkGpukE9YUrgPYvAZj2doVL0edfDgywTUh5CXa0o+nW9a1V9e5+CJTX8+SxRw==`. The package registry lists Unlicense: https://www.npmjs.com/package/isbot . Archive the exact package LICENSE and verify the provenance of the downloaded archive.

These are inventory/provenance findings, not legal clearance. The source/license and distribution checks remain open until the exact package archives, generated bundle, and notices are reviewed.

## Still-blocking release conditions

1. `docs/MODEL_LICENSE_MANIFEST.json` still has `entries: []`; no production model has passed strict admission. Do not fabricate model artifact hashes or use an upstream commit SHA as a bundle digest.
2. Contribution/copyright provenance and employer/contractor rights remain unverified.
3. Exact dependency archive and shipped-bundle/notices review remains incomplete.
4. Independent formal review is absent.
5. Exact-SHA promotion proof and production deployment are not demonstrated for this candidate. The current PR targets `execution`, so those production-only jobs are not expected to run on this PR event.
6. Do not issue a release certificate until the release candidate SHA has all required gates run successfully and the production artifact is verified against that SHA.


## Current candidate refresh — 2026-10-15

Current candidate head checked against PR #1323: `a2885a11f85c212454d644205701c39ee6935727` (base `execution`). Exact-SHA CI run: https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38767780141. The recorded workflow result is successful for the PR checks, including build/typecheck/lint, npm tests, production dependency audit, license metadata inventory, CodeQL, Gitleaks, security/red-team regression, exact-SHA contract checks, trust gate, and Chromium smoke.

Retained artifact digests reported for this run:
- Build: `sha256:91cd040effb10f5dd6d0f886187a1d0832165ed39f550d4f190fc4acc2531157`
- Browser evidence: `sha256:cf9e155df8a7fea0a1a6d1d2a306ff1a4a6e5e8ff58bbebcd7f57ce3a65034ef`
- Dependency license inventory: `sha256:42a9312796957b87138bb2659ab6a763a70ceae064094ebe97786229d111cb31`
- CodeQL SARIF: `sha256:07db1be670835790455ba23d4375368ac382674bca6181f1e35fe522d909d300`
- Exact-SHA coverage: `sha256:9c69c593c5f866a00158115ed78f9e926e4436031f14750b07c2e2f07f5f1e6d`
- Hub Stage 1: `sha256:262cff31e589c1bedb8f4768f36c21627882131c7100a60616e88472d1b745ed`

These successful PR checks do not close production-only gates: strict production model admission, exact-SHA promotion proof, and production exact-SHA deployment were skipped for this PR event. The PR remains open and its formal review list is empty. `docs/MODEL_LICENSE_MANIFEST.json` still has `entries: []`. This update records evidence only; it does not assert legal clearance, model admission, promotion, or production release.
