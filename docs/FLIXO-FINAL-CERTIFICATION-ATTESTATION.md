# FLIXO Final Certification Attestation

STATUS: NOT READY — TEMPLATE / NO CERTIFICATE ISSUED
REPOSITORY: m1m2m3m4m5m6m700-afk/FLIXO_Hub
EXECUTION_BRANCH: execution
PRODUCTION_BRANCH: main
INTEGRATION_PR: #1308
REFRESHED_UTC: 2026-10-15
CURRENT_EXECUTION_SHA_AT_REFRESH: 26cbe66da2b06c10ef36345df6e871f297f33134
CURRENT_MAIN_SHA_AT_REFRESH: 29f2e0fe045689337a1483ed98d087b736ff6afc

No final attestation is valid until all mandatory gates pass on one exact release candidate SHA, protected promotion reaches `main`, the actual production artifact is deployed by the canonical workflow, and independent verification confirms the deployed SHA and production behavior. These values are a checkpoint, not a statement that the current candidate is approved.

## Required attestation identities

- CURRENT_SHA
- TESTED_SHA
- BUILT_SHA
- BROWSER_VERIFIED_SHA
- SECURITY_VERIFIED_SHA
- COVERAGE_VERIFIED_SHA
- RED_TEAM_VERIFIED_SHA
- CERTIFIED_SHA
- DEPLOYED_SHA when applicable

Every identity must be the same eligible release lineage and retain exact-SHA evidence. Historical hashes and runs are context only and must never be copied into a new certificate as current proof.

## Current gate checkpoint

- **Production model admission: BLOCKED / CURRENT RUN PENDING.** The manifest on `execution` has `entries: []`. Main-bound PR #1308 now follows execution at head `26cbe66da2b06c10ef36345df6e871f297f33134`; fresh run [38783401694](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38783401694) is in progress at this checkpoint. The previous candidate `c740451b7c72e3c7f58c6e59f22588ccbda036b1` failed strict model admission, `trust-gate` and exact-SHA promotion proof in run #38782443480; production deployment was skipped. Do not copy that failure as the conclusion for the new SHA until its own run completes. No release-ready state may be inferred from a pending job.
- **Legal provenance: OPEN.** PR #1323 exact code head `dbe2583df4fd00b87f729d8565b3d0f0f817bf23` passed technical CI and Chromium in run [38781515366](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38781515366); its retained build artifact ID `11996287162` has verified archive SHA-256 `149404c915d7869fe68fab9c0d1d62707570cc03223dc4c552c99fa8270233c3`. An updated legal-register head `ee205ea91e1b57185aade132a8d32fc43fc6a318` subsequently passed technical CI, Chromium and trust-gate in run [38782344886](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38782344886); its build archive SHA-256 is `7e29aba6f2450ffe1d7eeb2c8e91b0b301fc18c40f8618e80912fbacc2c678f9`, with report `THIRD-PARTY-NOTICES.json` SHA-256 `6f994fbc826711ff41a4502eaf73fc63a1a459c671dc9d73aa6bab2957ee6b6a`. Mechanical notice text is materially improved, but ownership/relicensing authority, dependency compatibility, shipped-source provenance, full bundle/NOTICE obligations and independent legal review remain open.
- **Task registration consistency: RESOLVED ON EXECUTION.** PR #1332’s narrow atomic-registration policy merged to `execution` at `c740451b7c72e3c7f58c6e59f22588ccbda036b1`. PR #1333 then added the 39th canonical task, Prompt 39 and count-derived assertions in the four authorized files. Its exact-head run [38782686547](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38782686547) completed SUCCESS for build/typecheck/core tests, branch policy, Red Team, CodeQL, Secret Scan, Watchdog, coverage, sensitive-path, Hub Stage 1, Chromium and `trust-gate`; model admission, promotion proof and production deployment were skipped as not applicable to the execution-target registration PR. PR #1333 merged as `26cbe66da2b06c10ef36345df6e871f297f33134`. Ledger count and Hermes prompt count are both 39 and exact task card fields match. This resolves task-registration consistency, not the release gates.
- **Main ruleset: LIVE READ PASSED FOR PROTECTION CONFIGURATION, NOT FOR RELEASE PROMOTION.** Ruleset `23854302`, `FLIXO-MAIN-PROTECTION`, was read from the GitHub API on 2026-10-15 and is active for `refs/heads/main`. Its configuration reports one approving review, CODEOWNER review, latest-push approval, resolved review threads, stale-review dismissal, strict required checks `trust-gate` and `Exact-SHA promotion proof`, and no bypass actors. This current result contradicts the older claim that the main ruleset is weaker than policy.
- **Execution branch protection: UNKNOWN.** Reading the legacy branch-protection endpoint returned HTTP 403 `Resource not accessible by integration`. Do not translate missing read permission into a claim that protection is absent or sufficient.
- **Production deployment and post-deployment verification: NOT RUN.** The current exact-candidate run #38783401694 is still pending at this checkpoint. No successful exact-SHA production deployment receipt, immutable deployment identifier bound to the final release SHA, post-deployment browser journey, production model inference, or rollback drill is available. Existing Vercel deployments marked `READY` do not prove the canonical Cloudflare Worker release because the retrieved deployment record did not include the required source SHA.
- **Independent review: OUTSTANDING.** The critical release, legal and registration PRs did not have an independent submitted review in the latest review check. A verbal/conversational authorization is not a GitHub review event, and an author must not impersonate an independent reviewer.

## Attestation rule

Do not change `STATUS` to READY/CERTIFIED, do not populate `CERTIFIED_SHA` or `DEPLOYED_SHA`, and do not issue a release certificate until all gates are green on the final exact SHA, all required review and rights evidence is recorded, protected promotion is complete, the production artifact identity is verified, and an independent verifier signs off. Keep failure and skipped states visible. A passing execution-target CI run is technical-candidate evidence only, not promotion or production clearance.
