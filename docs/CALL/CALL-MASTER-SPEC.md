# FLIXO CALL Master Specification

Status: IMPLEMENTATION CONTRACT v1.0.0
Baseline: e6b88d26c0fa28f8d072fe0505d87cfb72db9abf

## Mission

CALL is a bounded multi-agent orchestration environment. The Master plans, delegates, coordinates, reconciles, and synthesizes. It is not an executor, verifier, certifier, merger, or alternate source of truth.

## Mandatory Master Plan

Every admitted mission MUST contain:
- objective
- why
- nonGoals
- steps
- requiredEvidence
- oppositionPlan
- exitCriteria
- budget
- deadline
- policyVersion and policyHash

No objective means no work. No complete plan means no assignment.

## Plan disposition

Master Plan -> Master Opponent -> Policy Kernel -> disposition.

Allowed dispositions:
- APPROVED
- REPLAN
- ESCALATE
- ADD_EVIDENCE

The Master cannot self-approve a plan rejected by policy or convert ESCALATED to APPROVED.

## Assignment

Every task has one primary Solver and one primary Opponent. Backups are recovery roles. The Opponent starts independently before Solver-result disclosure.

## Candidate

Candidate requires:
- exact candidate SHA
- Solver result
- Opponent challenge
- dispositioned conflicts
- required evidence
- complete handoff manifest

Candidate is never proof of correctness.

## Verification

Candidate -> Red Team -> independent Verification -> Certification -> execution acceptance.

CALL cannot merge directly into execution or main. Execution remains the canonical acceptance/execution lineage.

## Learning

Only promoted, independently verified outcomes may enter reusable Memory. XP is evidence-backed routing metadata, not authority.

## Termination

TERMINATED has exactly one terminal disposition:
- COMPLETED
- HALTED
- ESCALATED

Budget exhaustion is HALTED. Unresolved policy/security/canonical-boundary contradictions are ESCALATED.

## Recovery

Recovery is bounded by retry count, plan-round count, wall-clock budget, agent-run budget, and external-call budget. Repeated identical plan hashes are a plan loop.

## Gate A

Before Wave 3 expansion, execute the complete lifecycle twice on different SHAs under the same policy contract and compare protocol invariants. The purpose is protocol proof, not identical model output.
