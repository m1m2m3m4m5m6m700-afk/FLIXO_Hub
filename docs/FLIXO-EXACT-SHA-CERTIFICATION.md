# FLIXO Hub — Exact-SHA Certification Record

Status: NOT CURRENT CERTIFICATION

This document is a control-plane policy/evidence record. It must never be interpreted as certification merely because CI evidence exists.

## Current lineage

The active release candidate must come from the current controlled integration PR. This file intentionally does not self-embed a candidate SHA because changing the file would create a new commit and invalidate SHA-specific evidence.

- Current repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- Current integration path: `execution -> main`
- Current integration PR: `REQUIRED`
- Historical integration PR: #923 — HISTORICAL ONLY
- Direct main mutation: none
- Current candidate SHA: `REQUIRED`

## Required evidence

- typecheck/lint/core tests/build
- Chromium browser smoke
- trust-gate
- Exact-SHA promotion proof
- Agent Editor STEP 4
- Agent Editor Step 5-6
- internal exact-SHA coverage
- CodeQL
- Secret Scan/Gitleaks
- clean-clone Red Team
- deployment identity when applicable

## Current blockers

- Main governance ruleset does not currently require approvals/Code Owner review; Owner Action remains.
- Model admission manifest currently contains zero admitted production models.
- Release candidate freeze and owner-authorized execution -> main promotion remain pending.

Certification state: NOT_READY.
