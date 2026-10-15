# FLIXO Hub Release Readiness Plan

**Status:** IN PROGRESS — NOT CERTIFIED  
**Last updated:** 2026-10-15  
**Repository:** `m1m2m3m4m5m6m700-afk/FLIXO_Hub`  
**Integration path:** `execution → pull request → required checks/review → main → exact-SHA deployment verification`  
**Canonical production origin:** `https://flixoai.m1m2m3m4m5m6m700.workers.dev`  
**Plan owner:** release coordinator; all completion claims require machine-verifiable evidence.

> This is the durable execution tracker, not a release certificate. A checkbox may be marked complete only with evidence tied to the candidate SHA. Do not infer success from a commit existing, a workflow being skipped, a README improvement, or a deployment URL responding.

## Release rules (non-negotiable)

1. Do not push directly to `main`, force-push, rewrite history, or delete evidence to make gates pass.
2. Do not weaken tests, security checks, governance, or required reviews to achieve a green status.
3. Preserve one canonical tool registry/executor/verifier authority. Agents may propose and implement; they may not self-certify or promote to production.
4. Evidence must identify the repository, candidate SHA, workflow run, and (for deployment) immutable production identity. Any source mutation invalidates affected candidate-specific evidence.
5. A skipped, neutral, cancelled, stale, missing, or unverifiable check is not PASS.
6. If a required external permission/account action is unavailable, record it as BLOCKED with the owner and next action. Never fabricate access or evidence.
7. The release manifest and certificate remain NOT CERTIFIED until all mandatory gates pass.

## Current baseline and confirmed observations

- [x] Confirmed repository and integration branch names: `execution` and `main`.
- [x] Recorded live refs: `execution` = `23ee6b28df01ef01e7c2999cd02d08519278969c`; `main` = `29f2e0fe045689337a1483ed98d087b736ff6afc` (observed 2026-10-15). These are baseline identities, not certified release identities.
- [x] Inspected [CI run 38712763299](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38712763299) for `execution` SHA `23ee6b28df01ef01e7c2999cd02d08519278969c`: core typecheck/lint/contracts/build, npm test, audit, CodeQL, secret scan, Red Team, coverage, Hub Stage 1, and Chromium browser smoke passed. Production model admission failed; `trust-gate` and `Exact-SHA promotion proof` failed; production deployment was skipped. This candidate is NOT GREEN.
- [x] Inspected `package.json` on `execution`: the project declares Node.js `22.x`; `npm run build` includes typecheck, lint, Vite build, and build-artifact generation.
- [x] Inspected `.github/workflows/ci.yml`: CI includes contract/security checks, `npm test`, production dependency audit, build provenance, Hub Stage 1 contract, and Chromium E2E evidence.
- [x] Inspected `docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md`: candidate SHA, current workflow run, deployment ID, and immutable production identity are still `REQUIRED`; status is candidate/not certified.
- [x] Inspected `docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md`: status is NOT CERTIFIED and all release identity fields remain required.
- [x] Inspected `scripts/verify-public-launch-readiness.mjs`: structural verification explicitly says external account/legal actions and exact-SHA evidence are still required.
- [x] Located existing governance blocker records [#1125](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1125) and [#1059](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1059), which report that the `FLIXO-MAIN-PROTECTION` ruleset lacks required strict review controls. A fresh live read of the ruleset/branch protection was denied with GitHub API 403 `Resource not accessible by integration`; therefore current settings cannot be independently confirmed or changed through the present connection.
- [x] Confirmed a release-blocking license inconsistency: `LICENSE` contains AGPL-3.0 text, `CITATION.cff` declares Apache-2.0, the previous README claimed Apache-2.0, and `docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md` says no repository code license has been selected. No license was chosen by this work. The homepage wording is being corrected to disclose the mismatch; maintainer decision and full reconciliation remain required.
- [x] Found that `docs/FLIXO-PUBLIC-LAUNCH-EXECUTION-PLAN.md` was referenced by README but was not present on `execution` at baseline. This plan is being added at that path to restore the intended link.
- [ ] Re-run all baseline observations against the final candidate SHA before certification.

## Gate tracker

### A. Scope, ownership, and source identity

- [ ] Record current `execution` HEAD and `main` HEAD before release work.
- [ ] Identify the intended candidate commit and ensure all release changes are included.
- [ ] Freeze scope and record the candidate SHA in the release manifest.
- [ ] Confirm branch protection and required checks from live repository settings; do not assume settings from documentation.
- [ ] Confirm every candidate commit has valid task attribution and passes repository governance.
- [ ] Review all open release-related PRs for base branch, conflicts, stale evidence, and unresolved review findings.

### B. Build and code-quality gates

- [ ] Use Node.js 22.x as declared by `.nvmrc` / `package.json`.
- [ ] Install reproducibly with `npm ci`.
- [ ] Pass `npm run typecheck:contracts`.
- [ ] Pass `npm test` in full, including proposal validation, governance, architecture, registry, security, and core tests.
- [ ] Pass `npm run build`.
- [ ] Pass `npm run test:e2e -- --project=chromium` with recorded report.
- [ ] Confirm generated static routes, `robots.txt`, sitemap, and build provenance are correct.
- [ ] Capture CI run URL, job results, artifacts, and exact candidate SHA.

### C. Security, privacy, and adversarial checks

- [ ] Pass CodeQL/code scanning on the candidate SHA.
- [ ] Pass secret scanning and verify no new secrets were introduced.
- [ ] Pass `npm audit --omit=dev --audit-level=high` or document and resolve each blocking finding through the approved process; do not suppress findings without review.
- [ ] Pass Red Team and CELL hard-control checks on the candidate SHA.
- [ ] Confirm `/api/*` fail-closed behavior, security headers, canonical execution boundary, and output-contract verification.
- [ ] Verify no raw local `File`/`Blob` bytes leave the documented browser-local MVP path.
- [ ] Confirm secrets remain server-side and no credentials are exposed through `VITE_*` variables.
- [ ] Confirm no unresolved Critical/High security findings.

### D. Product and browser acceptance

- [ ] Verify production landing page and canonical origin resolve over HTTPS.
- [ ] Verify desktop and mobile browser smoke tests.
- [ ] Verify landing → tool/editor → local file input → explicit confirmation where required → execution → verifier → export/download.
- [ ] Verify failure states, unsupported formats, empty inputs, large inputs, and cancellation paths.
- [ ] Verify supported localization routes and no broken navigation or console/runtime errors.
- [ ] Verify privacy, support, accessibility, security-reporting, and legal links.
- [ ] Attach Playwright report and production smoke evidence to the candidate SHA.

### E. Deployment and immutable identity

- [ ] Confirm intended Cloudflare account/project/environment and deployment credentials are available through authorized configuration, without exposing secrets.
- [ ] Build the exact candidate SHA and deploy only through the approved production path.
- [ ] Record deployment ID, timestamp, provider receipt, and deployed source/build identity.
- [ ] Verify the live production identity endpoint matches the candidate SHA and source-tree identity.
- [ ] Run post-deployment smoke tests against the canonical production origin.
- [ ] Verify rollback target and perform the approved rollback drill or attach current accepted evidence.
- [ ] Re-run affected checks after any fix or deployment mutation.

### F. Legal, repository metadata, and launch operations

- [ ] Resolve the code-license contradiction with an explicit owner decision; reconcile `LICENSE`, README badges/text, package/repository metadata, and `docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md`.
- [ ] Configure and verify a real public support contact.
- [ ] Enable and test private vulnerability reporting if supported by the repository plan.
- [ ] Verify Dependabot, secret scanning/push protection, and CodeQL settings from live GitHub settings.
- [ ] Verify repository description, topics, social preview, discussions/community health, and contributor links.
- [ ] Verify Search Console/domain ownership, sitemap submission, analytics and consent requirements in external accounts where applicable.
- [ ] Review all public claims against the actual admitted capability registry; keep unavailable capabilities clearly labeled.
- [ ] Complete launch-day runbook, monitoring, incident, rollback, and distribution preparation.

### G. Certification and promotion

**External hard blocker:** live branch protection/ruleset administration is not available through the current GitHub connection (403). Do not attempt a code-side workaround. A repository owner/admin must verify and, if still needed, correct the live ruleset according to the policy documented in issues #1125 and #1059. An independent eligible reviewer must provide any required approval; self-approval is not acceptable.

- [ ] Independently review evidence lineage for the exact candidate SHA.
- [ ] Confirm every required check is PASS (not skipped, stale, or unverifiable).
- [ ] Update `docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md` with verified identities and evidence references.
- [ ] Obtain required human/repository review and merge through the approved PR path only.
- [ ] Verify the post-merge `main` SHA and production deployment identity after promotion.
- [ ] Fill `docs/FLIXO-PUBLIC-LAUNCH-CERTIFICATE-TEMPLATE.md` only after every gate passes.
- [ ] Publish a release tag and release notes bound to the verified SHA.
- [ ] Record final certificate URL, SHA, workflow runs, deployment ID, and browser evidence below.

## Active work records

### Repository homepage / PR #1312

- URL: https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1312
- Branch: `chore/official-repository-homepage-20261015`
- Initial commit: `deea570fcb05c9558f0bc2f1e5478d0a98492591`; latest observed head after license-disclosure correction and plan-link fix: `9bc1215a2fb474c5af99d3708f137a8d8644d358`.
- Scope: README only; target is `execution`, not `main`.
- Latest observed state: open; mergeable at time of latest query.
- Review state: automated Codex review summary reported findings/unresolved findings and usage limit prevented completion. Treat as NOT APPROVED until findings are independently reviewed and checks pass.
- [ ] Resolve review findings and verify links/claims. The README now discloses the `LICENSE` / `CITATION.cff` mismatch rather than asserting Apache-2.0; maintainer license decision remains OPEN.
- [ ] Confirm relevant checks and merge only when repository policy permits.
- Note: this documentation PR is not evidence that the application is deployable or certified.

### Release-readiness tracker plan

- Branch: `chore/release-readiness-plan-20261015`
- [x] Plan file committed; PR #1313 opened to `execution`: https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1313
- [ ] Verify this plan file is merged into `execution` and the canonical link is live.
- [x] Opened PR #1313 targeting `execution`; do not target `main` directly.
- [ ] Run the available plan/launch verifier and record its actual result.
- [ ] Keep this file updated with observed blockers and evidence URLs; do not mark gates complete based on assumptions.

## Evidence ledger

| Gate | Candidate SHA | Workflow / artifact / URL | Result | Notes |
| --- | --- | --- | --- | --- |
| CI + build | REQUIRED | REQUIRED | NOT VERIFIED | Must run on exact candidate SHA |
| CodeQL | REQUIRED | REQUIRED | NOT VERIFIED | Current evidence not yet captured |
| Secret scan | REQUIRED | REQUIRED | NOT VERIFIED | Current evidence not yet captured |
| Dependency audit | REQUIRED | REQUIRED | NOT VERIFIED | Current evidence not yet captured |
| Red Team / governance | REQUIRED | REQUIRED | NOT VERIFIED | Current evidence not yet captured |
| Chromium E2E | REQUIRED | REQUIRED | NOT VERIFIED | Current evidence not yet captured |
| Production identity | REQUIRED | REQUIRED | NOT VERIFIED | Deployment ID and immutable identity missing |
| Production smoke | REQUIRED | REQUIRED | NOT VERIFIED | Must run against canonical origin |
| Legal/external setup | N/A | REQUIRED | BLOCKED / OWNER ACTION | License and support/security settings require verified owner action |
| Certification | REQUIRED | REQUIRED | NOT CERTIFIED | All required gates must pass first |

## Blocker log

| ID | Blocker | Impact | Next action | Status |
| --- | --- | --- | --- | --- |
| REL-001 | No current exact-SHA release evidence assembled | Cannot certify or claim 100% | Establish candidate SHA and collect fresh CI/security/browser/deployment evidence | OPEN |
| REL-002 | Release manifest has REQUIRED identity placeholders | Cannot establish release lineage | Populate only after observing actual run/deployment identifiers | OPEN |
| REL-003 | `LICENSE` says AGPL-3.0, `CITATION.cff` says Apache-2.0, and legal blocker says license unselected | Legal/public-launch risk | Obtain explicit owner decision; reconcile LICENSE, README, citation metadata, and blocker ledger consistently | OPEN |
| REL-004 | External security/support/search/analytics settings not verified | Public launch operations incomplete | Verify live settings and record evidence or owner action | OPEN |
| REL-005 | PR #1312 has unresolved automated review findings | README change not yet accepted | Review findings, fix factual/link issues, and verify checks | OPEN |
| REL-006 | Launch plan link was missing on baseline `execution` | Broken project navigation and missing tracking artifact | Add this plan and verify the URL | IN PROGRESS |
| REL-007 | Main protection ruleset has historical reports of missing strict review controls; live API read is denied (403) | Production promotion/certification may be blocked | Repository owner/admin must verify and enforce required approvals, stale-review dismissal, Code Owner review, latest-push approval, thread resolution, and strict required checks; attach live evidence | BLOCKED_EXTERNAL |
| REL-008 | Production model admission failed: `docs/MODEL_LICENSE_MANIFEST.json` has `entries: []`; strict release gate requires at least one evidenced model | `trust-gate` and exact-SHA promotion proof fail; deployment job skipped | Maintainer/model owner must select a specific candidate, then verify exact version, immutable artifact SHA-256, license text, terms/AUP, provenance, compatibility, security/evaluation evidence, and human approval before registering PASS + ACTIVE | OPEN / OWNER DECISION |
| REL-009 | Windows Desktop Commander devices are offline; current connection cannot run commands on the working copy | Cannot independently run local targeted commands from this session | Bring authorized device online or rely on fresh CI runs and recorded artifacts; do not claim local execution occurred | BLOCKED_EXTERNAL |
| REL-010 | `.github/workflows/ci.yml` previously triggered `pull_request` only when the base branch was `main`; CodeQL, secret scan, and the exact-SHA workflow contract also encoded the old policy | Changes proposed for `execution` lacked a consistent canonical PR-triggered CI path | PR #1314 updates CI, CodeQL, secret scan, and the exact-SHA plus Agent-2 CI closure contracts. First run exposed stale assertions; fixes were committed. Latest head `e10ede70d899b7f6463879f1db7fbff373ce3064`, FLIXO CI run `38742691481` is pending; inspect final results before merge | IN PROGRESS / VALIDATION PENDING |

## Update protocol

For every work session:
1. Read this file first and inspect live repository/PR/workflow state.
2. Record current branch and exact SHA before changing files.
3. Work on a scoped branch and preserve existing work.
4. Run the narrowest relevant checks first, then required full gates.
5. Update the blocker log and evidence ledger with actual outcomes and URLs.
6. Never describe the project as 100% ready or certified until every mandatory gate has current, exact-SHA evidence and production verification.


## Live work items (2026-10-15)
- [ ] PR #1314 — CI workflow trigger correction, targets `execution`, head `e10ede70d899b7f6463879f1db7fbff373ce3064`; FLIXO CI run `38742691481` is pending.
- [ ] PR #1313 — durable release plan, targets `execution`; not merged.
- [ ] PR #1312 — README/homepage update, targets `execution`; not merged.

## Execution log

### 2026-10-15 — CI path repair candidate

- Created branch `agent/EXEC-LEAD-OFFICIAL-RELEASE-CERTIFICATION-001-ci-execution-pr-trigger-20261015` from `execution` to repair the discovered pull-request CI trigger gap.
- Updated `.github/workflows/ci.yml` so `pull_request` includes `main` and `execution`, and so the canonical verification job runs for same-repository PRs targeting `execution`.
- Updated `.github/workflows/codeql.yml` and `.github/workflows/secret-scan.yml` to run their security scans for same-repository PRs targeting `execution` while preserving the existing main-bound promotion conditions.
- Updated `.github/workflows/agent-watchdog.yml` to permit the watchdog suite for execution-bound PRs while retaining the `execution`-to-`main` promotion identity checks.
- Updated `scripts/ci/test-workflow-exact-sha-contract.mjs` to assert the new execution-PR trigger and security scan coverage.
- Candidate commit history includes `d29b985383de98b1ba3b1aa68349b9649891d272`, `dcb9d45954a4e494b552120af089c09f1d09b730`, `ba937e2068be967380c79a90069b8bb5ad252ce4`, `3315b256e79ca596302d349df64549963cb9f59a`, `aea50b0a9f7fe79e2acb4b98bd0498f71fed7c40`, and `f4f97dfbdeb4bcdb18e1ddfe8081c086996a9534`.
- Verification status: the workflow file contents were read back from GitHub, but a CI run for this branch has not been independently retrieved. The available commit-run query only exposes pull-request-triggered runs; do not mark CI PASS based on this.
- Pull-request creation through the connected GitHub action was blocked by platform safety checks. The branch is not yet represented by a reviewable PR; maintainer action is required to open/review it, then confirm all contract tests pass.
- This change does not resolve production model admission, legal license selection, main branch ruleset verification, exact-SHA promotion proof, or deployed production identity. No deployment or certificate was issued.