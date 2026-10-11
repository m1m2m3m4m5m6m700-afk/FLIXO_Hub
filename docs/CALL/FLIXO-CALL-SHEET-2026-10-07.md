# صحيفة FLIXO — agent-lab / CALL
Date: 2026-10-07

This is the operational index for the CALL implementation. It records architecture, boundaries, executable contracts, and verification status without promoting unverified targets to CURRENT.

## Canonical chain

EXE Leader -> Objective Registry -> CALL Master -> Master Opponent -> Policy Kernel -> Assignment -> Solver/Opponent -> Reconciliation -> Candidate -> Red Team -> Independent Verification -> Certification -> execution acceptance -> main only through release governance.

## Non-negotiable invariants

NO OBJECTIVE -> NO WORK.
No Solver + Opponent -> no task.
Opponent starts independently before Solver disclosure.
No self-certification.
Candidate requires Red Team.
Verification is independent.
Exact SHA binds artifacts.
Policy is versioned/hashed and not negotiable by agents.
Budget is an authority boundary.
Memory is append-only and evidence-backed.
XP is evidence-backed routing metadata, never authority.
CALL has no second executor/dispatcher/certification authority.
CALL never writes directly to main.

## Implemented in this branch

- docs/CALL/CALL-MASTER-SPEC.md
- docs/CALL/CALL-CONSTRAINTS.md
- packages/contracts/src/call-context.ts
- packages/contracts/src/call-policy.ts
- packages/contracts/src/call-policy-kernel.ts
- packages/contracts/src/call-mission-control.ts
- packages/contracts/src/call-ledgers.ts
- packages/contracts/src/call-objective-registry.ts
- packages/contracts/src/call-opposition.ts
- packages/contracts/src/call-red-team.ts
- packages/contracts/src/call-decision-log.ts
- packages/contracts/src/call-rollback.ts
- packages/contracts/src/call-reputation.ts
- packages/contracts/src/call-candidate-bundle.ts
- packages/contracts/src/call-gate-a.ts
- runtime integration for authority-owned context artifacts
- agent-lab governance, roles, protocols, prompts, templates, tool, and CI workflow
- CALL contract tests and Gate A harness

## Runtime P0

The canonical runtime path now computes an authority-owned SHA-256 context artifact from mission/task/objective/acceptance/constraints/opposition-policy hash/starting SHA before recording Opponent independent start. The supplied hash is no longer the runtime source of truth.

## Verification truth

The branch was created from execution at e6b88d26c0fa28f8d072fe0505d87cfb72db9abf. PR #1217 targets execution, not main.

Not yet proven:
- real GitHub Actions run for the new lab workflow
- Gate A on two real distinct SHAs
- live branch protection / ruleset compliance
- production certification
- #1125 closure

These remain explicitly unverified.

## External governance

Release blocker #1125 and ruleset 23854302 are separate human/org-admin work. Code cannot honestly mark them complete.

## Promotion rule

CALL produces Candidate/Evidence. EXE/execution decides Accept/Modify/Reject. Accepted work is re-applied and re-tested in execution. main receives only through existing release governance.
