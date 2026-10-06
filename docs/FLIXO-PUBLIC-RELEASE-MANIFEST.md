# FLIXO Public Release Manifest

Status: CANDIDATE / NOT CERTIFIED

This manifest is the single release-truth record for the public launch candidate. It must be updated only when the candidate SHA changes. Every PASS below must refer to the same exact 40-character SHA.

## Candidate identity

- Candidate SHA: RESOLVE FROM LIVE PR #1002 HEAD; this manifest does not self-certify or embed a self-referential commit SHA.
- Last fully verified candidate before this documentation rollover: `bfa98f6da5bdc28b21c4f22a926d4c219a7230a2`
- Candidate branch: `execution`
- Source main SHA at freeze: `263827228cbe5f4851470297fde5f2858ff844de`
- Release tag: `PENDING`
- Production deployment ID: `REQUIRED`
- Production immutable identity: `REQUIRED`
- Canonical production origin: `https://flixoai.m1m2m3m4m5m6m700.workers.dev`

## Required evidence

After any manifest mutation, current candidate evidence must be regenerated on the live PR #1002 head; no prior-SHA evidence is reused.

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
