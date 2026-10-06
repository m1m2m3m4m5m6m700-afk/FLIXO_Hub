# FLIXO Red Team Certification Record

STATUS: NOT READY

REPOSITORY: m1m2m3m4m5m6m700-afk/FLIXO_Hub
BRANCH: execution
CURRENT_SHA=REQUIRED
CURRENT_WORKFLOW_RUN=REQUIRED
CURRENT_EVIDENCE=REQUIRED
PRODUCTION_IDENTITY=REQUIRED
CERTIFIED_SHA=NOT_YET_CERTIFIED

This is the current Red Team evidence record. It is not a release certification and cannot carry a PASS claim unless every required adversarial result is regenerated on the same exact candidate lineage.

## Current adversarial contract

The current Red Team lane must verify, at minimum:
- canonical executor rejects unknown and non-admitted capabilities;
- prompt-injection-shaped and oversized requests fail closed;
- confirmation receipts cannot be replayed or transplanted;
- capability/catalog tampering is rejected;
- filename traversal, MIME/signature spoofing, extension mismatch, and unsafe ratios fail closed;
- browser E2E covers Agent confirmation and Manual execution across the canonical MVP scope;
- exact-SHA identity is checked for every candidate-sensitive run.

The dedicated adversarial suite remains `tests/red-team-control-plane.test.ts`. Its result is current only when the recorded exact SHA and workflow run match the candidate being evaluated.

## Exact evidence required before certification

- RED_TEAM_VERIFIED_SHA=REQUIRED
- CURRENT_WORKFLOW_RUN=REQUIRED
- CURRENT_EVIDENCE=REQUIRED
- CERTIFIED_SHA=NOT_YET_CERTIFIED

Any mutation after a verified candidate creates a new candidate SHA and invalidates the prior Red Team evidence.

## HISTORICAL / INVALIDATED — NOT CURRENT CERTIFICATION

STATUS=HISTORICAL — NOT CURRENT CERTIFICATION

Historical Red Team evidence retained for audit lineage:
- Historical verified candidate: `a44958a97126b2e050746010947aef2cfa286729`
- Historical Prompt 17 clean-clone result: PASS
- Historical workflow run: 37437187406 / run #239
- Historical integration reference: PR #1002
- Historical result covered the ten-tool browser-local MVP and adversarial control-plane regression.
