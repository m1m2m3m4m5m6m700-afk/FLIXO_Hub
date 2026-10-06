# FLIXO — Final Release Evidence

Status: NOT YET CERTIFIED / NOT YET PROMOTED

This document is a control-plane policy/evidence-record template. It is not a current certification statement.

## Current lineage

- Current repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- Current integration lane: `execution -> main`
- Current integration PR: `REQUIRED`
- Historical integration PR: #923 — HISTORICAL ONLY
- Direct main mutation: forbidden
- Exact release-candidate SHA: `REQUIRED`
- Current production immutable identity: `REQUIRED`

The exact release-candidate SHA must be read from the active controlled integration PR head and matched to all required evidence. This file intentionally does not self-embed its own commit SHA because editing it changes the SHA.

## Required evidence categories

- FLIXO CI verify/build
- Chromium browser smoke
- trust-gate
- Exact-SHA promotion proof
- Agent Editor STEP 4
- Agent Editor Step 5-6
- Agent Editor Coverage
- CodeQL
- Secret Scan/Gitleaks
- clean-clone Red Team
- deployment identity when applicable

## Current blockers

1. Main governance currently does not require approving review or Code Owner review; this remains an external Owner Action.
2. Production model admission remains governed by `docs/MODEL_LICENSE_MANIFEST.json`.
3. Release candidate freeze, exact-SHA certification, and owner-authorized execution -> main promotion remain pending.

## Final disposition

NOT_READY — BLOCKERS ENUMERATED

This file must not be changed to CERTIFIED/RELEASE VERIFIED until the active execution plan's exact-SHA evidence, governance, model admission, Red Team, certification, promotion, and post-merge requirements are all satisfied.
