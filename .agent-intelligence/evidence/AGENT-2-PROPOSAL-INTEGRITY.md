# AGENT-2 Proposal Integrity Evidence

## Validation baseline

- Agent: AGENT-2
- Scope: deterministic proposal validator / schema / proposal integrity
- Schema: Proposal Schema V4
- Pre-documentation validated SHA: ec791edb8540608de2f98ed7e1d5361aaa167183
- GitHub Actions run: 37547817613
- Workflow: FLIXO Proposal Integrity
- Result: SUCCESS
- Runner: Ubuntu / Python 3.12

## Gates

- Schema V4 contract: PASS
- V-01 Schema Conformance: PASS
- V-02 Exact Quote Verification: PASS
- V-03 Repository Reference Verification: PASS
- V-04 Rollback Verification: PASS
- V-05 Prompt Injection Detection/Quarantine: PASS
- V-06 TTL Validation: PASS
- V-07 Anti-Hype: PASS
- Security suite: PASS
- Malformed inputs: PASS
- Injection tests: PASS
- Path safety: PASS
- Proposal immutability: PASS
- No false-green behavior: PASS

## Red-team regressions closed

- Missing snapshot/file references now become deterministic validation failures instead of uncaught filesystem errors.
- Symbolic links are rejected for proposals, snapshots, and repository references.
- YAML duplicate keys, aliases, anchors, tags, flow syntax, malformed scalars, NULs, and oversized payloads are rejected.
- Prompt injection is quarantined and cannot become a valid proposal.
- Expired proposals are reported as EXPIRED and fail downstream validity.
- Unstable, marketing, opinion-only, promotional, trending, or unsupported quantitative claims fail V-07.
- The validator performs no shell execution and never mutates the proposal.

## Current HEAD note

This evidence record is being added after the validated baseline. The commit that contains this record MUST itself receive a fresh Proposal Integrity run before it is considered the final Agent-2 evidence SHA.

Agent-2 does not certify FLIXO product or release readiness.
