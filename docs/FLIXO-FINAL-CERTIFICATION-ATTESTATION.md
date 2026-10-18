# FLIXO Final Certification Attestation

STATUS: NOT READY
REPOSITORY: m1m2m3m4m5m6m700-afk/FLIXO_Hub
EXECUTION_BRANCH: execution
INTEGRATION_PR: #1308
RELEASE_PROFILE: MODEL_FREE_INITIAL_RELEASE

This document is a release attestation record, not certification by itself. It must never be treated as evidence that an unmerged candidate was deployed.

## Current release lineage

- Model-free implementation PR #1335 merged into `execution` on 2026-10-18.
- Current `execution` candidate / merge SHA: `47be48c1bccdc282f85e45fe3e6371f6914b48be`.
- Protected promotion PR #1308 from `execution` to `main` is open and not merged.
- The observed `main` SHA before promotion is `29f2e0fe045689337a1483ed98d087b736ff6afc`; it remains unchanged by PR #1335.
- Execution push CI [39145752548](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145752548) completed successfully on the current candidate SHA, including build/tests, security, Chromium, `trust-gate`, and exact-SHA promotion proof. The production deployment job was skipped because the event was an `execution` push.
- Main-promotion CI [39145757343](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145757343) completed with failure at `Exact-SHA promotion proof`: the wait step queried for separate workflow runs named `FLIXO CodeQL` and `FLIXO Secret Scan`, but those controls are jobs inside the same `FLIXO CI` run and the query returned `MISSING`. The proposed correction binds promotion proof directly to same-run `needs.codeql.result` and `needs.secret-scan.result`; it is still under review and needs fresh CI evidence.
- Supplementary merge-SHA evidence: TestSprite Live E2E run [39145752450](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145752450), clean-clone Red Team run [39145752431](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145752431), and governance contract run [39145757224](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145757224) succeeded.
- The autonomous promotion controller run [39145752543](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39145752543) failed when it tried to enable auto-merge through an unavailable `GITHUB_TOKEN` capability. The proposed controller correction records protected state without merging or enabling auto-merge. That correction is not yet merged into `execution`.

## Governance and approval evidence

The product owner stated in the conversation on 2026-10-18 that review was completed and instructed the executor to proceed assuming approval. This is recorded as owner-provided conversational authorization, not as a fabricated GitHub review submission.

The live `FLIXO-MAIN-PROTECTION` ruleset (ID `23854302`) was observed active on `refs/heads/main`. It requires one approving review, Code Owner review, latest-push approval, resolved review threads, strict `trust-gate`, and `Exact-SHA promotion proof`; no bypass actors are configured. The GitHub review API returned zero submitted reviews for PR #1308 at the last check. Therefore the required live review record remains a blocker until GitHub records it.

## Required attestation identities

- CURRENT_SHA
- TESTED_SHA
- BUILT_SHA
- BROWSER_VERIFIED_SHA
- SECURITY_VERIFIED_SHA
- COVERAGE_VERIFIED_SHA
- RED_TEAM_VERIFIED_SHA
- PROMOTION_PR: #1308
- CERTIFIED_SHA
- DEPLOYED_SHA when applicable

## Blocking conditions

1. Complete the current exact-SHA PR workflow and the pending exact-head promotion-proof correction.
2. Satisfy the actual protected GitHub review requirements on PR #1308; conversational approval does not bypass the ruleset.
3. Reconcile root `LICENSE` (AGPL-3.0 text) with `CITATION.cff` (Apache-2.0 declaration). The requested Apache target does not itself prove rights to relicense all contributions or third-party materials; maintain a rights/provenance evidence record.
4. Complete authorized promotion to `main) through the protected PR process. No agent may directly write, merge, or self-certify on `main`.
5. After an authorized main merge, record the main merge SHA, production deployment ID, immutable deployed identity, `/__flixo/build-provenance.json` receipt, and post-deployment browser/smoke evidence.
6. Verify public support contact, private vulnerability reporting, privacy/consent requirements, domain/Search Console, analytics, and rollback evidence before public launch.

No final attestation is valid until every applicable gate has current evidence bound to one release lineage and production identity. Until then the release remains `BLOCKED_WITH_EVIDENCE`.
