# FLIXO Red Team Certification Record

STATUS: HISTORICAL — NOT CURRENT CERTIFICATION

This document is retained as an evidence-history record. It is not a release certificate.
Any historical PASS below is invalid for a new candidate and must be regenerated on the exact
current candidate SHA.

## Current repository context

- Repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- Integration path: `execution -> main`
- Current candidate SHA: `REQUIRED`
- Current workflow run: `REQUIRED`
- Current Red Team evidence: `REQUIRED`
- Production immutable identity: `REQUIRED`
- Certification state: `NOT READY`

## Historical evidence retained — NOT CURRENT RELEASE TRUTH

Last fully verified candidate before the documentation rollover:
- Historical candidate SHA: `a44958a97126b2e050746010947aef2cfa286729`
- Historical Prompt 17 workflow: run `37437187406` / run #239
- Historical Prompt 17 result: PASS
- Historical execution candidate before the current closure branch was opened:
  `05e821dc735c54a8ad62a63c48ae97cf465c203e`

These values are preserved for audit lineage only. They have no current certification authority.

## Current control requirements

The dedicated adversarial suite remains:
`tests/red-team-control-plane.test.ts`

A current Red Team PASS is valid only when:
1. the test run is on the exact current candidate SHA;
2. the workflow run is identified;
3. CI/security/browser evidence is bound to the same SHA; and
4. production identity is bound to that SHA where deployment is applicable.

No historical PASS is reusable after mutation.
