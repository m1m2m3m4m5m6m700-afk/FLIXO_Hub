# FLIXO Hub Public Release Manifest

Status: CANDIDATE / NOT CERTIFIED

This manifest is a release-evidence template. It does not certify any candidate by itself.
Every current evidence claim MUST bind to one exact SHA, one workflow run, and the applicable
production identity. Any mutation invalidates prior candidate-specific evidence.

## Current repository identity

- Repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- Integration lane: `execution -> main`
- Candidate SHA: `REQUIRED`
- Candidate branch: `REQUIRED`
- Current workflow run: `REQUIRED`
- Current evidence: `REQUIRED`
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

Evidence from any other SHA is stale for this release candidate. A cancelled, skipped, neutral,
expired, unavailable, or otherwise unverifiable check is not PASS. Evidence is valid only when
repository, branch, candidate SHA, workflow run, and production identity (when applicable) agree.

## Promotion rule

Promotion is `execution -> pull request -> required checks -> review -> merge -> post-merge exact-SHA verification -> production identity verification -> browser verification -> release tag`.

No direct writes to `main`.

## Historical evidence retained — NOT CURRENT RELEASE TRUTH

The following values were observed before this governance-closure mutation. They remain available
as historical evidence only and MUST NOT be reused as current certification evidence:

- Historical execution head at closure start: `05e821dc735c54a8ad62a63c48ae97cf465c203e`.
- Historical active integration PR observed at closure start: `#1002`.
- Historical verified candidate SHA: `a44958a97126b2e050746010947aef2cfa286729`.
- Historical candidate SHA from the prior documentation rollover: `7d9266a42690417511d0202b3d06b6b362f2d7d4`.
- Historical state-reconciliation SHA: `52413f0f610c34cc988ecfc523134247c6cae135`.
- Historical candidate records `b3dd497f354a54434938582128e9ae45e2e94067` and `9d38d896d52514a916c3c5d7ed3244ae8db3a601`.
- The former repository identity `m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS` is historical only.

No historical SHA, PR, workflow run, deployment identity, or repository name above has current certification authority.
