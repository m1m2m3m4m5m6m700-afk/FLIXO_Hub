# FLIXO Final Release Certification

STATUS: NOT READY

This document is a certification template/state record, not certification by itself.

## Current release lineage fields

- Repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- Candidate branch: `REQUIRED`
- CURRENT_SHA: `REQUIRED`
- CURRENT_WORKFLOW_RUN: `REQUIRED`
- CURRENT_EVIDENCE: `REQUIRED`
- Production deployment ID: `REQUIRED`
- Production immutable identity: `REQUIRED`
- Browser verification receipt: `REQUIRED`
- Certification state: `NOT READY`

## Required gates

1. Clean-clone Red Team PASS on CURRENT_SHA.
2. Exact-SHA evidence for CI, tests, security, coverage, and browser verification.
3. Required GitHub governance policy on `main`.
4. Legitimate promotion through the protected `execution -> main` path.
5. Post-merge exact-SHA report and downstream production verification when applicable.

Independent governance approval remains required by the release policy.

Any missing, mixed-SHA, stale, skipped, cancelled, neutral, expired, or unverifiable evidence remains a blocker.

## Historical evidence

Older candidate SHAs and PR numbers may remain elsewhere in the repository for audit lineage. They are not current release truth.
