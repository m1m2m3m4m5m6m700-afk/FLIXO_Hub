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
- [x] PR #1314 — CI trigger/trust-gate repair merged into `execution`; merge SHA `b89c82fb52f40ee13b2151f98c644d3003f1de02`. Exact-head CI run [38744669546](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38744669546) passed on pre-merge SHA `e01dcca70f2b3659fa537108bd8f715d001a9593`.
- [x] PR #1318 — README/homepage refresh merged into `execution` as `f67bea2e082afb5a07a3333e58c685293e78755e` after run [38747102461](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38747102461) passed all checks, including Chromium smoke. PR #1312 was closed as superseded.
- [ ] PR #1313 — durable release plan, targets `execution`; open, exact-head run [38747281253](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38747281253) has the core/security/coverage/Stage 1 checks PASS while Chromium smoke was still running at last check.
- [ ] PR #1308 — protected release promotion, targets `main`, current head `f67bea2e082afb5a07a3333e58c685293e78755e`; blocked, not merged. Current run [38747919780](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38747919780) has already failed strict model admission because `docs/MODEL_LICENSE_MANIFEST.json` remains empty; remaining jobs are running. Prior same-SHA-at-the-time run [38746043460](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38746043460) completed failure at `trust-gate` and promotion proof, and skipped production deployment.

## Execution log

### 2026-10-15 — CI path repair candidate

- Created branch `agent/EXEC-LEAD-OFFICIAL-RELEASE-CERTIFICATION-001-ci-execution-pr-trigger-20261015` from `execution` to repair the discovered pull-request CI trigger gap.
- Updated `.github/workflows/ci.yml` so `pull_request` includes `main` and `execution`, and so the canonical verification job runs for same-repository PRs targeting `execution`.
- Updated `.github/workflows/codeql.yml` and `.github/workflows/secret-scan.yml` to run their security scans for same-repository PRs targeting `execution` while preserving the existing main-bound promotion conditions.
- Updated `.github/workflows/agent-watchdog.yml` to permit the watchdog suite for execution-bound PRs while retaining the `execution`-to-`main` promotion identity checks.
- Updated `scripts/ci/test-workflow-exact-sha-contract.mjs` to assert the new execution-PR trigger and security scan coverage.
- Candidate commit history includes `d29b985383de98b1ba3b1aa68349b9649891d272`, `dcb9d45954a4e494b552120af089c09f1d09b730`, `ba937e2068be967380c79a90069b8bb5ad252ce4`, `3315b256e79ca596302d349df64549963cb9f59a`, `aea50b0a9f7fe79e2acb4b98bd0498f71fed7c40`, and `f4f97dfbdeb4bcdb18e1ddfe8081c086996a9534`.
- Historical note: the initial branch read-back did not show a CI run. A follow-up reviewable PR was subsequently created as #1314 and its final head passed CI run #38744669546 before merge to `execution`.
- Historical note: PR creation for the first draft was blocked at that point; a later PR (#1314) was created through the authorized GitHub connector, passed exact-head CI, and was merged to `execution`. No direct `main` write occurred.
- This change does not resolve production model admission, legal license selection, main branch ruleset verification, exact-SHA promotion proof, or deployed production identity. No deployment or certificate was issued.
- Follow-up: corrected the newly added contract-test regular-expression escaping in commit `5fe8ddc12c81fbef1793fb601a1e5010609b57c5`. GitHub read-back checks confirm the trigger, same-repository guards, execution-base gates, watchdog boundary, and retained promotion-proof assertion are present. This is static content verification only, not a successful Node test run or CI run.
- Follow-up PR [#1315](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1315) was created as a draft and later closed after its Agent Watchdog fix was ported into the primary CI repair PR #1314.
- At the time of its check, PR #1315 had no reviews or runs; it is no longer active and was closed as superseded. The authoritative integration path is PR #1314 and its exact-head passing run #38744669546.
- Static contract checks performed against GitHub-read-back content: CI trigger includes `main, execution`; CI/CodeQL/secret-scan same-repository gates reference base `execution`; watchdog allows execution-bound PRs while preserving the main-promotion head check; exact-SHA promotion-proof assertion remains in the contract test. These are not substitutes for executing `node --test scripts/ci/test-workflow-exact-sha-contract.mjs` or the full CI suite.

## License acquisition closeout — 2026-10-15

- [ ] Code license decision: issue [#1316](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1316). Audit confirmed `execution/LICENSE` contains GNU AGPLv3 text, while `execution/README.md` and `execution/CITATION.cff` say Apache-2.0; the root `LICENSE` and `CITATION.cff` were not found on `main` during the audit. No metadata correction was committed because the GitHub write was rejected by platform safety checks. Do not try alternate write paths to bypass that rejection. Rights-holder/maintainer approval is still needed before declaring an operative repository-wide license; a custom §7(b) attribution condition is separate and not yet active.
- [ ] Production model license admission: issue [#1317](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1317). The production manifest has zero entries. First candidate research: the official Qwen/Qwen3-8B model page labels the model Apache-2.0 and the official API identifies revision `b968826d9c46dd6066d109eabc6255188de91218`; the page lists a 16.4 GB, five-shard artifact set (https://huggingface.co/Qwen/Qwen3-8B). That revision SHA is not the required artifact SHA-256. Exact bundle digest, applicable terms/AUP, provenance, compatibility/security evaluation and explicit human approval remain missing. The model is not admitted and must not be inserted as PASS.
- [ ] Keep release blocked until both license decisions and exact evidence are resolved. A label alone does not grant rights, and no model may be admitted automatically.

## Latest CI repair state — 2026-10-15

- Primary CI repair PR [#1314](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1314) was merged to `execution` as `b89c82fb52f40ee13b2151f98c644d3003f1de02` after exact-head run [38744669546](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38744669546) passed. This validates the integration CI repair only, not production launch readiness.
- Duplicate PR #1315 was closed after its watchdog fix was ported to #1314. No PR was merged to `main`, and no deployment or release certificate was issued.


## Trust-gate repair follow-up — 2026-10-15

- The prior run [38743827980](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38743827980) passed build/typecheck/lint/core contracts, CodeQL, Gitleaks, Agent Watchdog, Red Team, branch policy, sensitive-path assurance, Hub Stage 1, Chromium smoke and exact-SHA coverage, but failed `trust-gate`.
- Root cause from the trust-gate job log: the condition treated any PR head branch other than `execution` or `chore/oss-*` as a worker/diagnostic PR and expected validation jobs to be `skipped`. For same-repository PRs *targeting* `execution`, the validation jobs correctly ran successfully, so this classification caused the failure.
- Fixed `.github/workflows/ci.yml` to branch on `PR_BASE_REF == execution` plus `PR_HEAD_REPO == GITHUB_REPOSITORY` and require the full execution validation set to be `success`; narrowed the worker/diagnostic skip branch so it cannot swallow execution-targeted PRs. Added an explicit regression test to `scripts/ci/test-workflow-exact-sha-contract.mjs`.
- Current repair PR [#1314](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1314) head is `e01dcca70f2b3659fa537108bd8f715d001a9593`. A run on intermediate commit `a6428ba22d6d15b263251267f1b0b6ef102f67cc` observed Gitleaks scanning a range ending at the newer PR head `e01dcca70f2b3659fa537108bd8f715d001a9593` while its checkout was at `a6428ba22d6d15b263251267f1b0b6ef102f67cc`, causing an invalid revision range. Treat that run as failed evidence; do not override its result. The latest-head run `38744669546` was pending at last check and must be inspected for exact-SHA success.
- Production model admission remains skipped in the execution-PR lane by design and is release-blocking for main: `docs/MODEL_LICENSE_MANIFEST.json` has `entries: []`. Code-license mismatch and external-account/deployment identity evidence also remain unresolved.
- PR #1315 was closed after the needed Agent Watchdog fix was moved to the primary PR #1314. No main write, merge, deployment, or release certificate occurred.


## Final release-gate readout — 2026-10-15

Release certificate decision: **NOT CERTIFIED**.

The current `main`-bound candidate is `f67bea2e082afb5a07a3333e58c685293e78755e`; `main` remains unchanged at `29f2e0fe045689337a1483ed98d087b736ff6afc`.

- Latest run: [38747919780](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38747919780) is still running. Its strict production model admission job has already failed because `docs/MODEL_LICENSE_MANIFEST.json` has `entries: []`. Since the canonical trust gate requires model admission on a main-bound PR, this candidate cannot become promotable unless the required model evidence is legitimately admitted.
- Prior candidate run [38746043460](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38746043460) on SHA `b89c82fb52f40ee13b2151f98c644d3003f1de02` completed failure: strict model admission failed, `trust-gate` failed, Exact-SHA promotion proof failed, and production deployment was skipped.
- Positive evidence retained: exact-SHA CI on the CI repair PR passed before integration (run [38744669546](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38744669546)); the execution push run [38746033147](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38746033147) also passed all execution-push gates including trust-gate and promotion proof, but it skipped production deployment because it was not a main push. The README refresh passed all PR gates in run [38747102461](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38747102461) before merging into `execution`.

Required actions before certification:
1. Product owner/authorized reviewer selects the production model and deployment mode, and issue [#1317](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1317) receives exact pinned revision, actual artifact SHA-256 evidence, license text, model terms/AUP, provenance, compatibility/security/task evaluation and explicit human approval. No model may be marked PASS/ACTIVE by automation alone.
2. Rights holder resolves the conflicting code-license sources via issue [#1316](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1316). The README now discloses the contradiction but does not resolve the legal decision.
3. The latest main-bound candidate must pass all required checks on the same final SHA and receive protected human review.
4. After an approved merge, verify production immutable identity, JSON build provenance, live browser smoke and deployment receipt on that deployed SHA.
5. Complete owner-side support-contact, private vulnerability-reporting, external ownership/Search Console/analytics/consent, rollback and dependency-alert closure.

No source changed on `main`. There is no verified production deployment ID, release tag, post-deployment provenance receipt or official certificate.

## Follow-up homepage PR — 2026-10-15

- PR [#1318](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1318) refreshes the homepage from the latest `execution` base, removes the Apache-2.0 badge/direct licensing assertion, and accurately discloses the unresolved AGPLv3 vs Apache-2.0 metadata mismatch. It changes only README.md.
- The earlier PR #1312 was closed as superseded because its head was based on an outdated integration SHA. PR #1318 CI run [38747102461](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38747102461) is still in progress at the last check. This docs change does not itself grant a license or clear the owner decision.

## Main-bound release run disposition

- The main-bound PR [#1308](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1308) remains open and unmerged. Its run [38746043460](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38746043460) completed failure on candidate SHA `b89c82fb52f40ee13b2151f98c644d3003f1de02`: core build/tests, security scans, Red Team, browser smoke, coverage and Hub Stage 1 passed; strict model admission failed (`entries: []`); then `trust-gate` and exact-SHA promotion proof failed; production deployment was skipped.
- The production Worker deployment block in `.github/workflows/ci.yml` is main-push-only and validates deployment identity plus JSON provenance and deployed Chromium checks. Those post-deployment checks have not run for this candidate, so no production deployment identity or certificate exists.

## Latest recheck — main-bound release candidate (2026-10-15)

- PR [#1308](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1308) remains open and unmerged, latest head `eaeea292eb7616fefbec82fe75230125f5dc3d08`.
- Latest run [38750511769](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38750511769) completed FAILURE. Branch policy, Agent Watchdog, Red Team, CodeQL, typecheck/lint/contracts/build, Secret Scan, sensitive-path assurance, Hub Stage 1, coverage and Chromium browser smoke passed.
- Strict production model admission failed because the canonical manifest still contains `entries: []`. The dependent `trust-gate` and exact-SHA promotion proof failed; production exact-SHA deployment was skipped.
- Homepage/license-disclosure PR [#1318](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1318) was merged to `execution` as `f67bea2e082afb5a07a3333e58c685293e78755e`; its exact-head CI run [38747102461](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38747102461) succeeded. The README now flags license metadata for review but does not resolve the underlying legal choice.
- The legal decision issue [#1316](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1316) and model admission issue [#1317](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1317) remain open. Owner-side legal/model approval and artifact evidence cannot be manufactured by automation.
- Release certificate remains **NOT ISSUED**. No successful production deployment ID or post-deployment exact-SHA provenance receipt has been observed. `main` has not been changed by this work.


## Latest verified continuation (2026-10-15)

This section supersedes older run-specific observations above when they conflict. It does not certify the release.

- Latest inspected CI run: https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38750511769.
- Candidate model admission: FAIL at “Require one exact production-admitted model”; docs/MODEL_LICENSE_MANIFEST.json on execution has entries: [].
- In that run, Typecheck/lint/core contracts/build, npm test, production dependency audit, CodeQL, secret scan, Red Team adversarial regression, exact-SHA coverage, Hub Stage 1, and Chromium browser smoke completed successfully. These do not override the model-admission failure.
- Qwen/Qwen3-8B is listed as a candidate only. No production-manifest entry was added because exact artifact SHA-256, immutable version evidence, applicable terms/AUP, provenance, compatibility, security/evaluation evidence and accountable human approval have not been verified as a complete packet.
- License remains blocked: LICENSE contains AGPLv3 text; CITATION.cff declares Apache-2.0; docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md states the repository license has not been selected. No repository code license was selected or changed by this work.
- Live main-protection settings remain unverified through the current GitHub connection because prior live read returned 403. A repository owner/admin must capture the live ruleset evidence; no code-side bypass is acceptable.
- Desktop Commander is currently offline, so this session cannot claim local Windows execution. Fresh CI and repository API observations are the available evidence sources.
- Production deployment was skipped because required gates did not pass. Deployment identity, production smoke evidence, and an exact-SHA certificate remain outstanding.

### Next actions with accountable owners

| Blocker | Action | Owner | Closure evidence |
| --- | --- | --- | --- |
| MODEL-001 | Select model and assemble complete exact-version admission packet; register only after independent review | Model owner / maintainer | Manifest entry with real artifact SHA-256, license/terms/AUP, provenance, security/evaluation evidence and human approval; strict gate PASS |
| LEGAL-001 | Decide repository code license and confirm rights across contributions/dependencies | Rights holder / repository owner | Written decision and reviewed PR reconciling LICENSE, CITATION.cff, README and package metadata |
| GOV-001 | Verify and correct live main ruleset and required reviews/checks | GitHub repository owner/admin | Live settings evidence plus successful protected PR checks/review |
| DEPLOY-001 | Deploy only after admission/legal/governance gates pass | Authorized deployment operator | Provider deployment receipt, deployed SHA/build identity, and passing production browser smoke |
| CERT-001 | Assemble and independently review all evidence bound to one release SHA | Release verifier | Completed release manifest and certificate referencing exact SHA, workflows, deployment ID and browser evidence |
| OPS-001 | Verify real public support contact, private vulnerability reporting, and applicable external launch settings | Repository owner / launch operator | Live configuration evidence and successful test/report |

Do not mark blockers complete merely by adding a manifest row, changing a license label, or making a URL return HTTP 200. Re-run affected gates after changes and keep the certificate NOT CERTIFIED until every required gate passes.
