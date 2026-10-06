# FLIXO Exact-SHA Certification Record

STATUS: NOT READY
UPDATED: 2026-10-06
REPOSITORY: m1m2m3m4m5m6m700-afk/FLIXO_Hub
INTEGRATION_PATH: execution -> main

## Current release identities

CURRENT_SHA: `REQUIRED`
CURRENT_BRANCH: `REQUIRED`
CURRENT_WORKFLOW_RUN: `REQUIRED`
CURRENT_EVIDENCE: `REQUIRED`
TESTED_SHA: `REQUIRED`
BUILT_SHA: `REQUIRED`
BROWSER_VERIFIED_SHA: `REQUIRED`
SECURITY_VERIFIED_SHA: `REQUIRED`
COVERAGE_VERIFIED_SHA: `REQUIRED`
CERTIFIED_SHA: `NOT_YET_CERTIFIED`
DEPLOYED_SHA: `NOT_YET_VERIFIED`
PRODUCTION_IMMUTABLE_IDENTITY: `REQUIRED`

All current fields must be regenerated after any mutation and must resolve to one exact candidate lineage.

## Current governance evidence

Live GitHub ruleset FLIXO-MAIN-PROTECTION (ID 23854302) is active on `refs/heads/main`, but its current policy does not satisfy the repository's required governance contract:
- required approving reviews: 0 (required 1)
- dismiss stale reviews on push: false (required true)
- require Code Owner review: false (required true)
- require latest-push approval: false (required true)
- required review thread resolution: false (required true)
- strict required status checks: false (required true)
- required contexts currently present: `trust-gate`, `Exact-SHA promotion proof`

This is an external Owner Action blocker. No bypass or self-approval is permitted.

## Historical evidence retained — NOT CURRENT RELEASE TRUTH

The following exact-SHA evidence was valid only for historical candidates:
- Historical verified candidate SHA: `a44958a97126b2e050746010947aef2cfa286729`
- Historical Prompt 17 workflow run: `37437187406`
- Historical documentation-rollover candidate SHA: `7d9266a42690417511d0202b3d06b6b362f2d7d4`
- Historical state-reconciliation SHA: `52413f0f610c34cc988ecfc523134247c6cae135`
- Historical main base SHA: `263827228cbe5f4851470297fde5f2858ff844de`
- Historical PR context: `#1002`

These values are preserved for audit lineage and MUST NOT be presented as the current candidate.

## Certification state

CERTIFICATION: NOT READY
REASON: current exact-SHA evidence has not been regenerated after this mutation, and live main governance remains below the required policy.

Any subsequent mutation invalidates candidate-specific evidence again.
