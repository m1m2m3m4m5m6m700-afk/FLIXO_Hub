# FLIXO Prompt 01 — Current State Reconciliation

STATUS: NOT READY — THIS RECORD IS INVALIDATED BY ANY SUBSEQUENT MUTATION
PROMPT_ID: 01
SCOPE: READ_ONLY_STATE_RECORD
RECORDED_AT_UTC: 2026-10-06

START_SHA=REQUIRED
END_SHA=PENDING_THIS_RECORD_COMMIT
CURRENT_MAIN_SHA=REQUIRED
CURRENT_EXECUTION_SHA_AT_RECONCILIATION=REQUIRED
PR=REQUIRED
PR_HEAD_SHA_AT_RECONCILIATION=REQUIRED
PR_BASE_SHA=REQUIRED
PRIMARY_BRANCH=execution
INTEGRATION_PATH=execution -> main

This state record is coordination/evidence metadata only. It is not a runtime source of truth and never constitutes release certification.

## Required exact-SHA evidence

- FLIXO CI
- trust-gate
- Exact-SHA promotion proof
- FLIXO CodeQL
- FLIXO Secret Scan
- Chromium/browser evidence
- exact-SHA coverage evidence
- Red Team evidence

Every candidate-specific result must be regenerated after any repository mutation. A prior PASS cannot be carried forward to the new head.

## Current candidate evidence state

CURRENT_SHA=REQUIRED
CURRENT_WORKFLOW_RUN=REQUIRED
CURRENT_EVIDENCE=REQUIRED
CERTIFIED_SHA=NOT_YET_CERTIFIED
PRODUCTION_IDENTITY=REQUIRED

The record remains NOT READY until these identities and all required gates are bound to one exact candidate lineage.

## Governance evidence contract

GitHub main-governance state must be read live when certification is attempted. Any prior ruleset result, PR review result, or workflow result is historical after mutation and cannot be reused as current truth.

## Coordination contract

Agent execution may use controlled coordination branches, but current certification authority remains bound to the exact release candidate and protected integration path. A coordination branch is never a release certificate.

## HISTORICAL / INVALIDATED — NOT CURRENT CERTIFICATION

STATUS=HISTORICAL — NOT CURRENT CERTIFICATION

Previous Prompt 01 reconciliation record retained for audit lineage:
- Historical START/END candidate reference: `52413f0f610c34cc988ecfc523134247c6cae135`
- Historical main SHA: `263827228cbe5f4851470297fde5f2858ff844de`
- Historical PR: #1002
- Historical PR head at reconciliation: `52413f0f610c34cc988ecfc523134247c6cae135`
- Historical PR base: `263827228cbe5f4851470297fde5f2858ff844de`
- Historical FLIXO CI run: 37440599986
- Historical FLIXO CodeQL run: 37440599974
- Historical Secret Scan run: 37440599929
- Historical exact-SHA coverage job: 112193558491
- Historical Red Team job: 112193139561
- Historical execution-lane coordination repair evidence: `f76313b60e61c69e050473549a60f4612c959212`
- Historical documentation alignment evidence: `a0723f51c2cbfe00cf9804801659265d2c2ffb64`
- Historical governance ruleset reference: 23854302
- Historical governance review state recorded a missing independent human approval and under-hardened required checks.
- All historical PASS/FAIL results above remain retained but are not current certification evidence.
