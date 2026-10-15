# FLIXO Legal / External Launch Blockers

This document tracks owner/external-account actions and evidence required before a public launch. Repository automation must not represent external actions, legal review, ownership, or production deployment as complete without evidence.

## Repository code license

The repository owner selected **Apache-2.0** on 2026-10-15. The proposed metadata/text reconciliation is in PR #1323, targeting `execution`:
https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1323

The PR's CI checks, including Chromium Playwright E2E, passed on head SHA `192fb9d7204b0c314d91c20a563ef5367f572669`. This proves those checks for that candidate only; it does not prove contribution ownership, legal clearance, merge, promotion, or production deployment.

Still required:
- Independent review of the license diff and repository-wide `REUSE.toml` annotations.
- Contribution and copyright provenance review, including employer/contractor rights where applicable.
- Third-party source and dependency license/notice audit; preserve required notices and isolate any material that cannot be relicensed.
- Merge via the protected repository workflow and re-check evidence on the resulting exact SHA.
- Complete the production model-admission, exact-SHA promotion-proof, and production deployment gates; skipped jobs are not passes.

Track these items in issue #1316. Keep it open until the criteria have auditable evidence:
https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues/1316

## Public support contact

A real support contact must be configured and tested before launch. Do not publish a fabricated email address or identity. Record the owner-approved public contact and verify the destination works.

## Private security reporting

GitHub private vulnerability reporting/security-advisory capability must be enabled and tested before public launch. Confirm the repository setting and run a non-sensitive test of the reporting path without disclosing a real vulnerability.

## Search Console / analytics / privacy

External ownership verification, Search Console registration, sitemap submission, analytics provider configuration, and applicable privacy/cookie consent requirements must be completed in the relevant external accounts. Record evidence and verify the live domain. Do not claim these are complete from repository files alone.

## Distribution accounts

Product Hunt, Hacker News, Reddit, X, LinkedIn, YouTube, and email delivery require account-level actions only if they are in the approved launch scope. Repository automation can prepare content and runbooks but must not claim an account action or publication occurred without evidence.

## Release certificate rule

A release certificate may be issued only after required legal/security/quality gates pass, a protected promotion succeeds, and the live production identity and browser acceptance evidence match the exact promoted SHA. Do not infer release readiness from a green build or a skipped workflow job.
