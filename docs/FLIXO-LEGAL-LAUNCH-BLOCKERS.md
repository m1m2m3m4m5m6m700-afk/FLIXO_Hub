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