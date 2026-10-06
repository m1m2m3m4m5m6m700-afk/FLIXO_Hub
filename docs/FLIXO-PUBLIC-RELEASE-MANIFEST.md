# FLIXO Hub Public Release Manifest

Status: CANDIDATE / NOT CERTIFIED

This manifest is intentionally unfrozen at rest. A release candidate must be populated only after the active controlled integration PR is frozen and all evidence is bound to one exact SHA.

## Current repository identity

- Repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- Current integration lane: `execution -> main`
- Candidate SHA: `REQUIRED`
- Candidate branch: `REQUIRED`
- Source main SHA at freeze: `REQUIRED`
- Release tag: `PENDING`
- Production deployment ID: `REQUIRED`
- Production immutable identity: `REQUIRED`
- Canonical production origin: `https://flixoai.m1m2m3m4m5m6m700.workers.dev`

## Required evidence

- [ ] CI PASS on candidate SHA
- [ ] CodeQL PASS on candidate SHA
- [ ] Secret scan PASS on candidate SHA
- [ ] Dependency/security audit PASS on candidate SHA
- [ ] Red Team PASS on candidate SHA
- [ ] Browser E2E PASS on candidate SHA
- [ ] Production identity matches candidate SHA
- [ ] Production smoke PASS on candidate SHA
- [ ] No Critical/High unresolved security findings
- [ ] Public claims reviewed against the candidate capability registry

## Evidence integrity

Evidence from any other SHA is stale for this release candidate. A cancelled, skipped, neutral, expired, or unavailable check is not PASS. If any required artifact cannot be bound to the candidate SHA, the release gate is BLOCKED.

## Promotion rule

Promotion is execution -> pull request -> required checks -> review -> merge -> post-merge exact-SHA verification -> production identity verification -> browser verification -> release tag.

No direct writes to `main`.

## Historical stale identities explicitly retired

- `b3dd497f354a54434938582128e9ae45e2e94067` — historical candidate SHA; not current release truth.
- `9d38d896d52514a916c3c5d7ed3244ae8db3a601` — historical certification candidate; not current release truth.
- `faf261be4476eccf293956d792bbb15e2e019061` — historical production baseline; not current release truth.
