# FLIXO Public Release Manifest

Status: NOT READY

REPOSITORY: m1m2m3m4m5m6m700-afk/FLIXO_Hub
BRANCH: execution
CURRENT_SHA=REQUIRED
CURRENT_WORKFLOW_RUN=REQUIRED
CURRENT_EVIDENCE=REQUIRED
PRODUCTION_IDENTITY=REQUIRED
CERTIFIED_SHA=NOT_YET_CERTIFIED

This manifest is the current release-truth template. It must never present historical candidate evidence as current truth. A candidate-specific evidence record is valid only when every required artifact is bound to the same exact SHA and workflow run.

## Candidate identity

- Current candidate branch: `execution`
- Integration PR: `REQUIRED`
- Release tag: `REQUIRED`
- Production deployment ID: `REQUIRED`
- Production immutable identity: `REQUIRED`
- Canonical production origin: `https://flixoai.m1m2m3m4m5m6m700.workers.dev`

## Required current evidence

- [ ] Exact candidate SHA
- [ ] Exact workflow-run identity
- [ ] CI PASS on that candidate SHA
- [ ] CodeQL PASS on that candidate SHA
- [ ] Secret scan PASS on that candidate SHA
- [ ] Dependency/security audit PASS on that candidate SHA
- [ ] Red Team PASS on that candidate SHA
- [ ] Browser E2E PASS on that candidate SHA
- [ ] Production identity matches that candidate SHA when applicable
- [ ] Production smoke PASS on that candidate SHA
- [ ] No Critical/High unresolved security findings
- [ ] Public claims reviewed against the candidate capability registry

Until those artifacts exist on one exact lineage, the release state remains NOT READY.

## Evidence integrity contract

Evidence from any other SHA is stale for this release candidate. A cancelled, skipped, neutral, expired, unavailable, or mixed-lineage check is not PASS.

Any repository mutation creates a new candidate SHA and invalidates all previous candidate-specific PASS evidence. Historical evidence is retained only as historical evidence and cannot promote itself into current release truth.

## Promotion rule

Promotion is `execution -> pull request -> required checks -> review -> merge -> post-merge exact-SHA verification -> production identity verification -> browser verification -> release tag`.

No direct writes to `main`.

## HISTORICAL / INVALIDATED — NOT CURRENT CERTIFICATION

STATUS=HISTORICAL — NOT CURRENT CERTIFICATION

Previous execution records retained for lineage archaeology:
- Historical candidate referenced during an earlier documentation rollover: `7d9266a42690417511d0202b3d06b6b362f2d7d4`
- Earlier candidate-specific release evidence must be treated as stale after subsequent mutations.
- Historical source-main freeze: `263827228cbe5f4851470297fde5f2858ff844de`
- Historical integration reference: PR #1002
- Historical candidate wording included a live PR head reference and is retired from current identity fields.
