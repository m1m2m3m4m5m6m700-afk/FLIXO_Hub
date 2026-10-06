# FLIXO — Exact-SHA Certification Policy

Status: POLICY / NOT CURRENT CERTIFICATION

The authoritative candidate is the live head of PR #1002 on `execution`, resolved at verification time. This document intentionally does not embed a candidate SHA because changing the document would invalidate the evidence it attempted to describe.

## Required exact-SHA identities
CURRENT_SHA, TESTED_SHA, BUILT_SHA, BROWSER_VERIFIED_SHA, SECURITY_VERIFIED_SHA, COVERAGE_VERIFIED_SHA, CERTIFIED_SHA, and DEPLOYED_SHA when production deployment is applicable.

## Required gates
- typecheck, lint, core tests, build;
- Agent + Manual browser E2E;
- security and secret scanning;
- CodeQL;
- coverage evidence;
- clean-clone Red Team;
- governance state;
- exact deployment identity where applicable.

## Certification rule
Implemented or historical evidence is not current certification. Prompt 19 may issue certification only when all required gates pass on one exact candidate lineage and no governance or deployment blocker remains.

Current state: NOT READY until those conditions are independently observed.
