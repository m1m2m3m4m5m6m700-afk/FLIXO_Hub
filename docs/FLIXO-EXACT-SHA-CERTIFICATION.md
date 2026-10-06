# FLIXO Exact-SHA Certification Record

STATUS: NOT READY

REPOSITORY: m1m2m3m4m5m6m700-afk/FLIXO_Hub
BRANCH: execution
CURRENT_SHA=REQUIRED
CURRENT_WORKFLOW_RUN=REQUIRED
CURRENT_EVIDENCE=REQUIRED
PRODUCTION_IDENTITY=REQUIRED
CERTIFIED_SHA=NOT_YET_CERTIFIED

This is the current fail-closed exact-SHA evidence record. It intentionally contains no candidate-specific SHA, workflow-run identifier, deployment identity, or certification claim until the evidence is regenerated on the current frozen candidate.

## Required current identities

- CURRENT_SHA=REQUIRED
- TESTED_SHA=REQUIRED
- BUILT_SHA=REQUIRED
- BROWSER_VERIFIED_SHA=REQUIRED
- SECURITY_VERIFIED_SHA=REQUIRED
- COVERAGE_VERIFIED_SHA=REQUIRED
- RED_TEAM_VERIFIED_SHA=REQUIRED
- CURRENT_WORKFLOW_RUN=REQUIRED
- CURRENT_EVIDENCE=REQUIRED
- DEPLOYED_SHA=REQUIRED when deployment is applicable
- CERTIFIED_SHA=NOT_YET_CERTIFIED

All current identities must resolve to one candidate lineage. Any repository mutation creates a new candidate SHA and invalidates all earlier candidate-specific PASS evidence.

## Governance state

Governance and review state must be read live from the protected repository when certification is attempted. A historical governance result must not be treated as a current blocker or current PASS without fresh evidence.

## Scope

The canonical executable MVP remains the current ten-capability scope defined by the runtime registry. This record is evidence metadata only and is not runtime authority.

## HISTORICAL / INVALIDATED — NOT CURRENT CERTIFICATION

STATUS=HISTORICAL — NOT CURRENT CERTIFICATION

The following evidence is retained for lineage archaeology and is invalid for the current candidate:
- Last fully verified candidate: `a44958a97126b2e050746010947aef2cfa286729`
- Historical Prompt 17 clean-clone evidence: workflow run 37437187406 / run #239
- Historical integration reference: PR #1002
- Historical main SHA at that verification cycle: `263827228cbe5f4851470297fde5f2858ff844de`
- Historical governance ruleset reference: ruleset 23854302
- Historical candidate-specific evidence included typecheck, lint, build, coverage, Red Team, browser, CodeQL, and secret-scan results.
- Those results are retained as historical evidence only and cannot certify a later SHA.
