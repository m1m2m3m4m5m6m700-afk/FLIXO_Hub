# FLIXO_Hub — Deployment Certification Execution Ledger

- Mission: `EXEC-LEAD-OFFICIAL-RELEASE-CERTIFICATION-001`
- Refreshed (UTC): `2026-10-15T17:36:00Z` (tool-session timestamp; subsequent commit/run timestamps are authoritative)
- Repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- Production branch: `main`
- Integration branch: `execution`
- Current `main` SHA: `29f2e0fe045689337a1483ed98d087b736ff6afc`
- Current `execution` SHA: `eaeea292eb7616fefbec82fe75230125f5dc3d08`
- Mission task-registration PR: [#1327](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1327), head `9b6a8aa766d2361a0908e700657405079670b412`, base `execution`
- Current release decision: **`BLOCKED_WITH_EVIDENCE`**. Do not issue a certificate.

## Evidence refreshed during this mission

### Repository, promotion and CI

- [Main branch ref](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/tree/main): `29f2e0fe045689337a1483ed98d087b736ff6afc`, commit `fix(knowledge): allow large repository snapshot blobs (#1270)`.
- [Execution branch ref](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/tree/execution): `eaeea292eb7616fefbec82fe75230125f5dc3d08`, commit records upstream Qwen3-8B research-only shard integrity; it explicitly does not admit a model to production.
- [Release promotion PR #1308](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1308) is open from `execution` to `main` at head `eaeea292eb7616fefbec82fe75230125f5dc3d08`. Its exact-head CI [run #38750511769](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38750511769) failed: strict production model admission failed, trust-gate and Exact-SHA promotion proof failed, and production deployment was skipped. Other technical jobs, including build/test, security, CodeQL, Red Team and browser checks, passed on that SHA; those passes do not override the failed mandatory gates.
- [Mission branch diagnostic run #38777368503](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38777368503) failed on a stale mission branch that was 17 commits behind `execution`; one failing test expected a main-only PR trigger while the branch's CI intentionally listed `[main, execution]`. Do not use that run as evidence against the live `execution` SHA.
- [Registration PR #1327 CI run #38778095685](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38778095685) completed failure on the exact PR head `9b6a8aa766d2361a0908e700657405079670b412`. The Agent 2 security-contract suite reports:
  - `ACTIVE_TASK_COUNT_MISMATCH:declared=38:actual=39`
  - `QUEUE_COUNT_MISMATCH declared=38 actual=39`
  - Hermes task/prompt synchronization still has 38 prompts while the canonical queue has 39 tasks.
  This is a cross-file contract conflict: repository policy says ledger PRs must be ledger-only, but the invariant requires the canonical task ledger, generated Hermes prompt view, declared count and two fixed-count tests to be updated together. Do not ignore CI, weaken exact matching, or merge a failing registration PR. A governed resolution must make task registration and its generated view/count contract atomically verifiable without relaxing exact task/prompt ID equality.
- [Agent-3 triage run #38778095809](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38778095809) passed on the registration PR SHA; Scout Boundary skipped. These do not substitute for failed CI or independent review.
- PR #1327 has no submitted formal review at this checkpoint.

### Live governance

- [Live ruleset #23854302](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/rules/23854302) is active for `refs/heads/main`. Current API response reports one required approving review, stale-review dismissal, CODEOWNER review, latest-push approval, review-thread resolution, strict status-check policy, required contexts `trust-gate` and `Exact-SHA promotion proof`, and no bypass actors.
- This live read contradicts the older descriptive state in [issue #1125](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1125); reconcile the issue against the live ruleset and actual protected promotion. Do not repeat its older weaker-settings claim as current fact.
- Reading legacy branch-protection detail for `execution` at `GET /repos/m1m2m3m4m5m6m700-afk/FLIXO_Hub/branches/execution/protection` returned HTTP 403, `Resource not accessible by integration`. Required access is a GitHub token/app permission capable of reading that protection endpoint (or an authorized administrator must provide the response). No bypass or setting mutation was attempted.
- `.github/CODEOWNERS` assigns security-sensitive paths to the repository owner only. Formal independent PR reviews were empty on #1323 and #1325 at refresh; the mission PR #1327 also has no formal review. A self-authored review is not independent evidence.

### Model identity and admission

- [Production model manifest on execution](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/blob/execution/docs/MODEL_LICENSE_MANIFEST.json), blob `267030e158af32f700f638c055779816fc81e2f2`, has `entries: []`.
- [Issue #1317](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1317) identifies `Qwen/Qwen3-8B` at upstream revision `b968826d9c46dd6066d109eabc6255188de91218` as a candidate to evaluate, not as an approved production model. Per-shard upstream hashes documented there are not the required whole-artifact-set digest. A deterministic manifest-builder PR #1325 only adds tooling; it did not hash the real ~16.4 GB artifact set or execute runtime evaluations.
- Required missing evidence: explicit product-owner model/deployment-mode selection; actual runtime/artifact access; deterministic hash for the entire exact artifact set (including configuration/tokenizer); exact license/model terms/AUP and provenance; hosting compatibility; security and task-quality evaluations; fallback/performance results; and the required approval. Never create a fabricated `PASS/ACTIVE` manifest entry.

### Legal provenance

- [License decision proposal PR #1323](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1323) remains open and targets `execution`; formal review list returned empty. The proposed Apache-2.0 license selection is not evidence that every contribution can be relicensed.
- [Issue #1316](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1316) and [legal provenance register on the license branch](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/blob/agent/EXEC-LEGAL-APACHE-2-20261015/docs/FLIXO-LEGAL-PROVENANCE-REGISTER.md) leave ownership, historical contributions, employer/contractor rights, third-party assets, bundled licenses, attribution/NOTICE and independent review unresolved.
- Dependency metadata inventory is not license clearance. Still require actual archive/bundle review for `jszip@3.10.1` (MIT OR GPL-3.0-or-later), `lightningcss@1.33.0` and platform package distribution/notices (MPL-2.0), and `isbot@5.2.1` (Unlicense).
- [Legal launch blockers](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/blob/execution/docs/FLIXO-LEGAL-LAUNCH-BLOCKERS.md) include authentic public support contact, private security reporting enablement/test, Search Console/domain ownership, analytics/consent and distribution-account tasks. No account-side evidence was found in this review.

### Deployment and post-deployment evidence

- Canonical release target in `wrangler.jsonc` is Cloudflare Worker `flixoai`, expected origin `https://flixoai.m1m2m3m4m5m6m700.workers.dev`. The repository CI's canonical production deployment job runs only on a `push` to `main`, depends on the promotion proof, verifies exact SHA and build-artifact identity, and deploys the recorded artifact; it must remain the deployment route.
- Vercel project metadata shows old `READY` deployments, but the fetched deployment record did not contain a Git source SHA. Vercel SSO protection is enabled for the observed project aliases. A Vercel deployment marked READY is not proof of the canonical Cloudflare deployment for the release SHA.
- Listing deployments through the Vercel deployment list endpoint returned HTTP 403 for `GET /v7/deployments`; no different-scope retry is treated as evidence. Exact deployment lookup works for known IDs, but does not reveal final release identity.
- Attempts to reach the canonical Cloudflare and Vercel public hostnames from the current execution environment failed at DNS resolution / URL access. This is an environment limitation, not proof that production is down. No current live reachability/browser or deployed SHA check can be claimed from that failure.
- No successful exact-SHA production deployment run, immutable Cloudflare deployment identity, deployed artifact digest, post-deployment browser journey, production model inference, or rollback drill was found for the current candidate.

## Immutable CI artifact registry

The GitHub artifact API for [run #38775574603](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38775574603) returned these retained artifacts. They bind to PR #1323 candidate SHA `042d54baa164658c64f5a00a080cf63c8b4a5e7c`, not to final `main` or current `execution`.

| Artifact | Artifact ID | GitHub archive SHA-256 | Meaning / limitation |
|---|---:|---|---|
| Dependency license inventory | `11993077999` | `39df6c0b5b23ffcda145ff444443d7abadf7c09e93dcdae21260d22557a3484a` | ZIP checksum independently recalculated on the downloaded archive and matched the GitHub API digest. Inventory JSON SHA-256: `ea6705c99a2ace5bae9d2417da39dc1825cb338e16ac4f202011f6951e520de9`; Markdown SHA-256: `82a50d6c1be4315736e3ba9bdae652bedf523d7b0a40cb88d6d8c53bb6bcf01e`. |
| Build artifact | `11992674751` | `cce3259cee9516c6b20dcaa048b849beec42f5019c3b43af435a1539b13f2c2f` | Successful build artifact on that PR SHA; not the final production artifact. |
| Chromium browser evidence | `11994086143` | `0fc939789708480ce361a81f98b793240840b86673c159e00e9844231b94f92f` | Browser evidence archive on that PR SHA; not post-deployment verification. |
| Exact-SHA coverage | `11993881365` | `5deca18c8bae91e28d072c5f51979aa339b917e1e54239f7c267311657009792` | Coverage archive on that PR SHA. |
| CodeQL SARIF | `11992964209` | `5b20fab4b87ce26d9d3849bdd62cbdcb0b7f86f5a3c14da666c648544c517e94` | Security-analysis archive on that PR SHA. |
| Gitleaks SARIF | `11992604555` | `6ef4b7d3253d5e48056a8d02f31c4bfc02a5c0bdd59f8a3c58b10f9b9a9d1ffd` | Secret-scan archive on that PR SHA. |

The inventory lists 262 package-lock metadata entries, one ignored workspace link, one ignored stale extraneous lock entry, and zero unresolved/missing license metadata entries. Its generated report explicitly warns that metadata is not license compatibility, ownership, NOTICE compliance, or redistribution clearance.

### Upstream dependency evidence gathered

- [JSZip upstream repository](https://github.com/Stuk/jszip) states dual licensing under MIT or GPLv3. The pinned lockfile entry for `jszip@3.10.1` is `(MIT OR GPL-3.0-or-later)`. Project must preserve the actual v3.10.1 upstream license/copyright files and document the chosen MIT option in the shipped notices; upstream current branch or metadata alone is not proof the shipped archive is correct.
- [Lightning CSS 1.33.0 upstream package metadata](https://github.com/parcel-bundler/lightningcss/blob/master/package.json) reports `MPL-2.0`. The exact run's inventory classifies `lightningcss@1.33.0` and its platform packages as development-only; confirm whether any source/binary code or required notices enter the distributed files before closing this item.
- [isbot npm package metadata](https://www.npmjs.com/package/isbot?activeTab=readme) and [version record](https://secure.software/npm/packages/isbot/versions) identify `isbot@5.2.1` as Unlicense. The exact run's inventory provides registry resolution URL and package integrity `sha512-dJ+LpKyClQZ7NG+j3OensC/mAZkGpukE9YUrgPYvAZj2doVL0edfDgywTUh5CXa0o+nW9a1V9e5+CJTX8+SxRw==`. Still preserve and inspect the exact 5.2.1 archive LICENSE and package source before claiming complete provenance.

These are source and metadata findings, not an independent legal opinion. Contributor/employer ownership, bundle membership, chosen compatible license, required notices, and distribution rights remain unresolved.

### Model runtime architecture cross-check

At the refreshed `execution` SHA, `src/worker.ts` declares an asset binding and deployment SHA only, and explicitly returns an API-not-found response for paths starting `/api/`. The inspected client intent path `src/lib/agent-guided-runtime.ts` routes through the local canonical tool registry, intent router, plan parser and canonical executor; no remote model invocation was identified in those files. This is a scope finding, not an automatic waiver of the repository's strict model-admission job. The release owner/maintainers must either supply actual production model/provider evidence required by the gate or make an authorized, documented architecture decision about model-gate applicability with an independently tested governance change. Do not fabricate a model entry or alter the gate solely to get a green result.

- Additional exact-source cross-check: `src/config/registry.ts` exposes the `TOOL_DEFINITIONS` list as the canonical registry, and `src/routes/localized-tool.tsx` resolves dynamic tool routes from that registry and returns Not Found unless the tool exists and is marked ready. The inspected `src/config/canonical-tool-definition.ts` on the same execution SHA contains no `ai-image-generator` / `generate-image` definition, while `src/tools/ai-image-generator/index.tsx` exists as an isolated component. Its test `tests/ai-image-generator.spec.ts` stubs `/api/ai/image` with a synthetic PNG, so it proves only the component's behavior against a mocked endpoint, not production inference. The canonical Worker is intentionally configured to 404 every `/api/*` path, and `docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md` explicitly excludes image generation from certified MVP claims. Current release messaging should therefore not claim image generation as available. This scope boundary does **not** cancel the separate strict model-admission policy; only a separately reviewed governance/architecture decision can change that gate.

## Gate ledger

| Gate | Status | Required closure evidence |
|---|---|---|
| A — Build, CI, security, browser acceptance | BLOCKED | Repair the registration-ledger CI count/prompt invariant under an authorized repository process; run all mandatory jobs on the final assembled candidate SHA, with no skipped mandatory check. |
| B — Model identity, licensing and production admission | BLOCKED | Verify the selected actual production model and deployment mode, real artifact-set digest, terms/provenance, runtime/security/task evaluations and strict `--require-entry` admission PASS. |
| C — Legal provenance and distribution rights | BLOCKED | Complete file/contributor/employer rights and shipped-artifact/dependency/NOTICE review; obtain required permissions and a genuinely independent legal/provenance review. |
| D — Exact-SHA governance and promotion | BLOCKED | Resolve task-registration CI contract; complete required independent review(s), current exact-SHA checks and authorized protected `execution → main` promotion. Live main ruleset appears strict; execution protection read was denied (403). |
| E — Production deployment | NOT_RUN for this candidate | Canonical CI production-deploy job succeeds on the actual release SHA with artifact identity/digest and immutable deployment identifier. |
| F — Post-deployment verification | NOT_RUN for this candidate | Test the actual canonical production URL, critical browser/API journeys, runtime/model behavior, headers/notices/logs and rollback readiness against the deployed artifact. |
| G — Evidence integrity and independent verification | BLOCKED | Exact-SHA evidence index, reproducible hashes and an independent verifier record, with failed/skipped checks retained visibly. |

## Next executable actions

1. Resolve the repository's task-registration transaction conflict without weakening exact prompt/ledger equality or violating a required approval. PR #1327 remains open and its failed CI is retained.
2. Reconcile PRs #1323/#1324/#1325 on a single consistent candidate, including package metadata and root license alignment, only with required checks and genuine independent review.
3. Obtain and verify actual model/runtime/legal evidence. If the intended artifact or rights-holder confirmations are unavailable, leave the corresponding gates blocked.
4. Re-run all mandatory SHA-bound gates on the final candidate; promote only through the protected PR path.
5. Verify the post-merge `main` SHA and run the canonical Cloudflare production deployment. Verify the deployed artifact and production behavior; have a separate verifier validate evidence integrity.

## Terminal decision

`BLOCKED_WITH_EVIDENCE`. No deployment-readiness certificate is issued. Mandatory reasons include the currently empty production model manifest/no real artifact digest or runtime evidence, unresolved legal rights and independent reviews, the failed task-registration CI invariant, and the absence of current exact-SHA deployment/post-deployment evidence. The main ruleset reads strict from the current API; issue #1125 requires reconciliation rather than repeating stale values.


## Latest release checkpoint — exact promotion candidate `c740451b7c72e3c7f58c6e59f22588ccbda036b1`

- **Refreshed UTC:** 2026-10-15, based on the GitHub Actions and ref APIs as last queried for this checkpoint.
- **Current `main`:** `29f2e0fe045689337a1483ed98d087b736ff6afc`.
- **Current `execution`:** `c740451b7c72e3c7f58c6e59f22588ccbda036b1`, the squash merge from PR #1332 only.
- **Open promotion PR #1308** now has exact head `c740451b7c72e3c7f58c6e59f22588ccbda036b1` and base `29f2e0fe045689337a1483ed98d087b736ff6afc`. Its fresh CI run [#38782443480](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38782443480) is running. At the last job snapshot:
  - **FAIL:** Production model admission — job “Require one exact production-admitted model”; the production manifest still has `entries: []`.
  - **PASS:** Branch policy, Red Team regression, typecheck/lint/core contracts/build, Gitleaks/Secret Scan, CodeQL, Watchdog security integration, sensitive-path assurance, exact-SHA internal coverage, Hub Stage 1.
  - **IN PROGRESS:** Chromium browser smoke.
  - Therefore `trust-gate`, final promotion proof, and production deploy cannot be considered passes. The prior run #38750511769 is a historical SHA result; run #38782443480 is the current release-head evidence.
- PR #1332’s governance-only clarification was merged into `execution` at `c740451b7c72e3c7f58c6e59f22588ccbda036b1` after its exact-head checks, including trust-gate, passed in [run #38781812393](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38781812393). It authorizes a narrow four-file atomic registration transaction and does not relax prompt equality or any release gate.
- PR #1333 is the resulting exact four-file registration transaction, head `6e3ab64ae51ff9d78f9263029be94a4640e943f4`. On that candidate the canonical active count and generated Hermes prompts both equal 39, the new release task has exactly 13 synchronized fields, and the fixed `38` literals were replaced with derived counts. [CI run #38782686547](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38782686547) is still IN_PROGRESS; registration is not accepted until every required job passes on that exact head.
- PR #1323’s code candidate `dbe2583df4fd00b87f729d8565b3d0f0f817bf23` passed technical CI, Chromium, coverage, Hub Stage 1 and trust-gate in run #38781515366. Its corrected built distribution artifact `11996287162` was downloaded and inspected: ZIP SHA-256 `149404c915d7869fe68fab9c0d1d62707570cc03223dc4c552c99fa8270233c3`; embedded candidate SHA and source tree match the run; the notices report records 50 external runtime packages, one private workspace separately tracked with rights unverified, one exact-version isarray MIT fallback, and zero runtime packages without any copied license/notice text. A later documentation-only head `ee205ea91e1b57185aade132a8d32fc43fc6a318` updates the legal register with these hashes and has its own CI [run #38782344886](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38782344886) still in progress. Those artifact and CI results do not close authorship/relicensing rights, dependency compatibility, third-party/copy-source provenance, bundle/NOTICE review, or independent legal review.
- PR #1329 attestation-template reconciliation passed technical CI on its own SHA, but is still an open PR and not a certificate. All model/production promotion/deployment jobs were skipped on that execution-target PR.

### Updated terminal decision

`BLOCKED_WITH_EVIDENCE`. The current main-bound candidate has a fresh, explicit strict-model-admission failure; the actual production model manifest is empty. The registration and legal-evidence PRs have technical validation in progress on newer SHAs. No protected promotion, production deployment, post-deployment identity/browser receipt, independent rights review, or final certification has occurred. Do not merge PR #1308, publish, or issue a certificate until the strict model gate and every other mandatory gate pass on the exact candidate SHA.


## Latest registration and promotion checkpoint — 2026-10-15

- Current `main`: `29f2e0fe045689337a1483ed98d087b736ff6afc`.
- Current `execution`: `26cbe66da2b06c10ef36345df6e871f297f33134`.
- **Task registration is now accepted into execution:** PR #1332 established the narrowly scoped atomic-registration transaction and merged at `c740451b7c72e3c7f58c6e59f22588ccbda036b1`; PR #1333 then atomically registered `EXEC-LEAD-OFFICIAL-RELEASE-CERTIFICATION-001`, added prompt 39 and made both count assertions derived from the canonical queue. PR #1333 exact head `6e3ab64ae51ff9d78f9263029be94a4640e943f4` merged as `26cbe66da2b06c10ef36345df6e871f297f33134` after [CI run #38782686547](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38782686547) completed successfully: typecheck/lint/build/core tests, branch policy, Red Team, CodeQL, Secret Scan, Watchdog, coverage, sensitive-path assurance, Hub Stage 1, Chromium and trust-gate all PASS. Production model admission, exact-SHA promotion proof and production deployment were skipped, not passed, for the execution-target registration PR.
- Main-bound PR #1308 now follows execution at exact head `26cbe66da2b06c10ef36345df6e871f297f33134`. New run [#38783401694](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38783401694) is in progress; model admission is pending/queued in that run at the last observation. Do not carry forward the completed failure on prior candidate `c740451b...` as the conclusion for the new SHA, but keep that result in history. The manifest remains `entries: []`; if the new run reports the same admission failure, that is the current decisive blocker.
- Corrected legal-notice build was verified on candidate `dbe2583df4fd00b87f729d8565b3d0f0f817bf23` in run #38781515366, and a rebuilt artifact for the updated register SHA `ee205ea91e1b57185aade132a8d32fc43fc6a318` was inspected from run [#38782344886](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub). Its build ZIP digest is `7e29aba6f2450ffe1d7eeb2c8e91b0b301fc18c40f8618e80912fbacc2c678f9`; notice JSON digest `6f994fbc826711ff41a4502eaf73fc63a1a459c671dc9d73aa6bab2957ee6b6a`; notice Markdown digest `9d4192d63e9f17a36c237d2096b525ce1ee59a1783bf3d9855ca26ca7a21d4ad`. The exact built report records 50 runtime packages, one rights-unverified private workspace, one pinned isarray MIT fallback, and zero external package entries without copied license/notice text. Legal provenance remains OPEN despite the mechanical notice fix.
- Formal independent legal review, historical contributor/employer rights evidence, full bundle/asset attribution review, and required release-owner approval remain open. The current release candidate has not been deployed, and no production identity, post-deployment browser evidence or rollback proof exists.

### Current gate decision

`BLOCKED_WITH_EVIDENCE`; continue exact-SHA verification on head `26cbe66da2b06c10ef36345df6e871f297f33134`. Task registration and its count/Prompt mismatch are resolved. The remaining critical path is real production-model admission (or an independently approved and tested governance applicability decision), legal-rights/provenance clearance, then all required exact-SHA trust/promotion checks, actual production deployment, post-deployment identity/browser verification and independent certification. No certificate is issued by this ledger update.
