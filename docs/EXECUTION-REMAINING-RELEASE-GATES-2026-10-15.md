# Release Gate Closure Plan — 2026-10-15

Status: OPEN / RELEASE BLOCKED. This document records verified blockers and the exact evidence needed to close them. It is not a release certificate.

## Current evidence

- Model manifest on execution: docs/MODEL_LICENSE_MANIFEST.json, schema 1.1.0, status ACTIVE, entries=[]; production model admission cannot pass without a reviewed entry and real artifact evidence.
- PR #1325: head 3b4123c0fd6629fefe31612723d3c524190b7c39; adds deterministic inventory/hash tooling only. Its description explicitly says the real 16.4 GB model bundle has not been hashed or runtime-tested.
- Workflow run 38773708311: typecheck/lint/core contracts/build, npm test, production dependency audit, CodeQL, secret scan, Red Team, watchdog integration, Hub Stage 1, sensitive-path assurance, and exact-SHA coverage succeeded. Chromium browser smoke was still in progress at the latest inspection. Production model admission was SKIPPED.
- PR #1323: head 459975ea24c21f7ea4e0cb89de9c5f730ca157a0; Apache-2.0 license reconciliation is proposed, not merged. No formal reviews were recorded at inspection. Its own description says contribution ownership, third-party compatibility, and rights remain unverified.
- The legal blocker document on PR #1323 already records owner selection of Apache-2.0 and outstanding provenance, external support contact, private vulnerability reporting, Search Console/analytics, and distribution-account actions. Do not revert that newer branch document to older stale text on execution.

## Closure checklist

1. [ ] Wait for and record final Chromium result and browser artifact digest for the exact candidate SHA.
2. [ ] Obtain the actual intended model files from an authoritative source. Record model name/version/provider, immutable source, download date, applicable license and model card/acceptable-use terms, and usage restrictions.
3. [ ] Run scripts/build-model-artifact-manifest.mjs against the complete model directory. Preserve per-file hashes, sizes, canonical manifest, aggregate artifact_sha256, command/version, and evidence location. Do not substitute an upstream revision or invented digest.
4. [ ] Complete a strict model manifest entry only from verified evidence; evaluate source/provenance, commercial use, fine-tuning, redistribution, distillation, adapters, trademarks, training-data restrictions, lifecycle, and independent review. Run npm run test:model-license:release and the protected production admission workflow. No model entry means no admission.
5. [ ] Complete file-level copyright/contribution and employer/contractor rights review. Review copied/vendor assets, file-level SPDX/REUSE declarations, upstream notices, Apache NOTICE obligations, and actual shipped artifacts.
6. [ ] Triage exact package archives and shipped bundles/notices for jszip@3.10.1 (MIT OR GPL-3.0-or-later), lightningcss MPL-2.0 packages, and isbot@5.2.1 (Unlicense). Lockfile metadata alone is not legal clearance.
7. [ ] Obtain formal independent review on PR #1323 and PR #1325 from authorized reviewers. Automation authors cannot self-certify legal or model rights.
8. [ ] Verify real public support contact, private vulnerability reporting/security advisory capability, external ownership/Search Console/analytics and consent settings, and distribution accounts where required. Record proof without publishing fabricated identities.
9. [ ] After reviews and required evidence, re-run gates on the final exact candidate SHA. Promotion proof and production deployment must execute, not be skipped, and must attest to the same SHA and live artifact.
10. [ ] Issue a release certificate only after every mandatory gate is PASS and evidence is durable and SHA-bound.

## Safety boundaries

- Do not push directly to main, force-push, delete files as a workaround, bypass branch protection, or merge without required reviews and checks.
- Do not claim an external action, legal clearance, model admission, browser pass, promotion, or deployment without corresponding evidence.
- A successful execution-branch CI run is not a production release certificate.
