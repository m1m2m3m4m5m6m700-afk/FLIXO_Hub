# FLIXO Engineering Intelligence — Agent 2

Agent-2 is the deterministic validator for Engineering Intelligence proposals.

Canonical assets:
- .agent-intelligence/schemas/proposal.schema.yml
- .agent-intelligence/schemas/snapshot.schema.yml
- .agent-intelligence/scripts/validate.py
- .agent-intelligence/scripts/test_validate.py
- .agent-intelligence/schemas/test_schema.py

The validator:
- enforces Proposal Schema V4;
- verifies exact evidence quotes against immutable source snapshots;
- verifies repository references stay inside the repository and reject symbolic links;
- quarantines prompt injection;
- expires stale proposals;
- rejects anti-hype and unverifiable evidence;
- rejects missing or non-actionable rollback;
- rejects duplicate YAML keys and unsafe YAML constructs;
- never mutates the proposal;
- never approves or certifies a proposal.

Exit codes:
0 VALID
1 REJECTED / QUARANTINED / EXPIRED
2 VALIDATOR OR SYSTEM ERROR

Any error is visible and fail-closed. No swallowed exception can produce PASS.
