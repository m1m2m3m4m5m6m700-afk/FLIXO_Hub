# DECISIONS.md

## Governance Decisions

### DRAFT-001
Status: PROPOSED / NOT APPROVED.
Decision: v1.3/v1.4.1 governance remains non-ACTIVE until approval evidence is independently verifiable.
Source: docs/AGENT-LEAD-MEMORY-GOVERNANCE-v1.4.1-DRAFT.md and merged governance contract.

### DRAFT-002
Status: PROPOSED / NOT APPROVED.
Decision: EXEC-LEAD-MEMORY-001 has a dedicated closure criterion and was exempt from ordinary memory synchronization during initial creation.
Source: v1.4.1 Bootstrap section.

### DRAFT-003
Status: PROPOSED / NOT APPROVED.
Decision: Owner approval cannot be established from prose in PR comments or memory files; accepted approval evidence must satisfy the contract's GitHub metadata requirement or its explicitly accepted signed-commit form.
Source: v1.4.1 approval/evidence sections.

### DRAFT-004
Status: PROPOSED / NOT APPROVED.
Decision: Automatic downgrade enforcement begins only after at least 10 completed merged PRs in the measurement window.
Source: v1.4.1 metrics section.

### DRAFT-005
Status: PROPOSED / NOT APPROVED.
Decision: Tool/security blocks use an Issue labeled agent-blocked or agent-blocked-global according to scope.
Source: v1.4.1 blocked-channel section.

### DRAFT-006
Status: PROPOSED / NOT APPROVED.
Decision: Admission is execution-scoped only, read-only, exact-SHA bound, and must not imply Approval, Merge, ACTIVE, or Production.
Source: v1.4.1 Admission sections.

### DRAFT-007
Status: PROPOSED / NOT APPROVED.
Decision: Downgrade metrics are evaluated over the last 30 days, capped at 20 merged PRs, with a 10-PR enforcement floor and the canonical thresholds implemented in scripts/ci/agent-governance-metrics.mjs.
Source: v1.4.1 Downgrade section.

### DRAFT-008
Status: PROPOSED / NOT APPROVED.
Decision: Admission rejects closed-loop execution when canonical governance verification is unavailable or downgrade thresholds are breached.
Source: v1.4.1 Admission and Failure sections.

### POST-MERGE-001
Status: RECORDED / NON-ACTIVATING FACT.
Decision: PR #1257 was merged into main at exact merge commit 508b5f9f9314deb7cbfd6d6592450b7d5f39141e. This records successful bootstrap delivery only and does not by itself establish owner approval, ACTIVE authority, certification, or production promotion.
Evidence: GitHub PR #1257 metadata and main ref observed 2026-10-08.

### POST-MERGE-002
Status: RECORDED / NON-ACTIVATING FACT.
Decision: The verified GitHub signature on merge commit 508b5f9f9314deb7cbfd6d6592450b7d5f39141e is evidence of commit verification, but is not treated as a PR APPROVE review or as independent owner approval under the current contract.
Evidence: GitHub commit verification metadata observed 2026-10-08.

### POST-MERGE-003
Status: RECORDED.
Decision: Memory synchronization after merge must be performed through the governed PR path, not by direct mutation of main.
Evidence: v1.4.1 persistent-memory and CODEOWNERS rules.

## Unverified
- Owner approval under the accepted approval-evidence rule.
- ACTIVE authority.
- Certification.
- Production promotion.
- Live agent-blocked label enforcement.
