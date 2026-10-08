# DECISIONS.md

## Bootstrap Decisions

### DRAFT-001
Status: PROPOSED / NOT APPROVED.
Decision: v1.3 remains a draft until owner approval is independently verifiable.
Source: docs/AGENT-LEAD-MEMORY-GOVERNANCE-v1.3-DRAFT.md.

### DRAFT-002
Status: PROPOSED / NOT APPROVED.
Decision: EXEC-LEAD-MEMORY-001 has a dedicated closure criterion and is exempt from ordinary memory synchronization during initial creation.
Source: v1.3 draft, Bootstrap section.

### DRAFT-003
Status: PROPOSED / NOT APPROVED.
Decision: Owner approval must be verifiable from GitHub metadata; memory text alone cannot prove approval.
Source: v1.3 draft, approval section.

### DRAFT-004
Status: PROPOSED / NOT APPROVED.
Decision: Automatic downgrade requires at least 10 completed PRs in the measurement window.
Source: v1.3 draft, metrics section.

### DRAFT-005
Status: PROPOSED / NOT APPROVED.
Decision: Tool/security blocks use an Issue labeled agent-blocked.
Source: v1.4.1 draft, Bootstrap section.

### DRAFT-006
Status: PROPOSED / NOT APPROVED.
Decision: Admission is execution-scoped only, read-only, exact-SHA bound, and must not imply Approval, Merge, ACTIVE, or Production.
Source: v1.4.1 draft, Admission sections.

### DRAFT-007
Status: PROPOSED / NOT APPROVED.
Decision: Automatic downgrade is evaluated only after at least 10 completed merged PRs in the last-30-days window capped at 20, using the canonical telemetry definitions in agent-governance-metrics.mjs.
Source: v1.4.1 draft, Downgrade section.

### DRAFT-008
Status: PROPOSED / NOT APPROVED.
Decision: Admission rejects closed-loop execution when the live governance verifier is unavailable or when automatic downgrade thresholds are breached.
Source: v1.4.1 draft, Admission and Failure sections.

## ما لم يُتحقق منه
- Owner approval.
- Existence or enforcement of the agent-blocked label/workflow.
- Enforcement of the 10-PR floor.
