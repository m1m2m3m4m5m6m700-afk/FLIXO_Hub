# FLIXO — Canonical CELL Architecture & Assignment Contract

Document status: CURRENT architecture boundary + TARGET orchestration contract + HISTORICAL classification
Repository: m1m2m3m4m5m6m700-afk/FLIXO_Hub
Inspected baseline: main @ de1e5b3c46bc1f5812987cb8ad863c5ff983178d
Target integration lane: execution
Authority: this document is an architecture contract; it does not itself implement runtime behavior.

## 0. Scope and status model

This file is the canonical description of CELL mission/task orchestration, assignment, opposition, arbitration, candidate handoff, verification, certification mapping, promotion, learning, and frontier flow.

It must not create a second Dispatch Authority, Runtime Registry, Executor Authority, Certification Authority, or alternate source of truth.

| Status | Meaning |
|---|---|
| CURRENT | Verified as implemented/authoritative on the inspected repository baseline. |
| TARGET | Required canonical end state for CELL orchestration. |
| PROPOSED | New contract defined here; requires implementation and evidence before CURRENT. |
| HISTORICAL | Provenance/archaeology only; never runtime truth. |
| SUPERSEDED | Older conflicting model; not active architecture. |

Documentation cannot promote TARGET/PROPOSED to CURRENT.

## 1. CURRENT repository architecture

Human Authority
→ deterministic Control Plane
→ Planner / Executor / Verifier

Canonical capability path:
MVP executable capability definitions
→ TOOL_REGISTRY / TOOL_CATALOG
→ executeCanonicalTool()
→ output-contract assertion
→ capability verifier
→ verified artifact

CELL assignment orchestrates ownership and challenge roles, while capability execution remains delegated to the existing canonical runtime authority. No Agent certifies, merges, or promotes to main. Evidence is exact-SHA scoped.

## 2. Preservation boundary

Older CELL material, including broad bot pools, swarm-memory models, multiple registries, executor registries, workflow runners, and provider-controlled execution models, is archaeology only.

The existing الخلية.md and cell.md material is preserved. Neither is a competing authority. This file is the canonical architecture/assignment contract; existing companion material must not be interpreted as a second CURRENT flow.

## 3. ONE CANONICAL CELL FLOW — TARGET

MISSION
→ TASK ADMISSION
→ ASSIGNMENT
→ PAIR LOCK
→ OPPONENT INDEPENDENT START
→ SOLVE ⇄ FALSIFY
→ RECONCILIATION
→ ARBITRATION when materially disputed
→ CANDIDATE
→ RED TEAM
→ INDEPENDENT VERIFICATION
→ CERTIFICATION
→ PROMOTION
→ LEARNING
→ FRONTIER
→ MISSION

Recovery returns to the appropriate state and preserves lineage. Alternate flows may be historical or superseded, never a second CURRENT runtime flow.

| Stage | Status |
|---|---|
| MISSION | CURRENT/TARGET |
| TASK ADMISSION | TARGET |
| ASSIGNMENT | TARGET |
| PAIR LOCK | TARGET |
| OPPONENT INDEPENDENT START | TARGET |
| SOLVE ⇄ FALSIFY | TARGET |
| RECONCILIATION | TARGET |
| ARBITRATION | TARGET |
| CANDIDATE | TARGET |
| RED TEAM | TARGET |
| INDEPENDENT VERIFICATION | CURRENT capability / TARGET CELL stage |
| CERTIFICATION | CURRENT governance concept / TARGET CELL stage |
| PROMOTION | CURRENT governance protection / TARGET CELL stage |
| LEARNING | TARGET |
| FRONTIER | TARGET |

## 4. Invariant Registry

This is documentation only. It is not a Runtime Registry and never competes with TOOL_REGISTRY or TOOL_CATALOG.

| ID | Statement | Status |
|---|---|---|
| INV-CELL-001 | Canonical CELL flow follows the single ordered lifecycle. | TARGET |
| INV-CELL-002 | Every admitted task has exactly one primary Solver and one primary Opponent. | TARGET |
| INV-CELL-003 | Solver/Opponent identities are distinct unless a bounded independence waiver exists. | TARGET |
| INV-CELL-004 | No task is admitted without a complete Opposition Plan. | TARGET |
| INV-CELL-005 | Assignment binds solverId, opponentId, backupSolverId, backupOpponentId, riskClass, oppositionPlan, falsificationPolicy, verificationPolicy, and independencePolicy. | TARGET |
| INV-CELL-006 | Opponent receives only approved shared task context/evidence; Solver private reasoning is excluded. | TARGET |
| INV-CELL-007 | Opponent records its initial challenge position before Solver-result disclosure. | TARGET |
| INV-CELL-008 | Solver cannot adjudicate its own disputed claim. | TARGET |
| INV-CELL-009 | Disputes follow CLAIM → COUNTERCLAIM → EVIDENCE → ARBITRATION → DISPOSITION. | TARGET |
| INV-CELL-010 | Opponent and Red Team are separate stages. | TARGET |
| INV-CELL-011 | Verification is independent from Solver/Opponent conclusions. | TARGET/CURRENT-compatible |
| INV-CELL-012 | Certification maps to existing Governance/certification. | TARGET |
| INV-CELL-013 | Verification/certification evidence is bound to the exact candidate SHA. | CURRENT-compatible |
| INV-CELL-014 | Historical architecture is never implicitly promoted to CURRENT by documentation. | CURRENT |
| INV-CELL-015 | Promotion, learning, and Frontier remain downstream of verified/certified state. | TARGET |

No second CELL invariant namespace and no reused invariant ID are permitted.

## 5. TASK ADMISSION — TARGET

Admission is a fail-closed function inside the canonical Control Plane, never a second dispatcher.

Required envelope:
taskId, missionId, solverId, opponentId, backupSolverId, backupOpponentId, riskClass, oppositionPlan, falsificationPolicy, verificationPolicy, independencePolicy, constraints, acceptanceCriteria, relevantEvidence.

Opposition Plan requires:
attackSurface, falsificationQuestions, expectedCounterexamples, evidenceThatWouldDisproveSuccess, independenceRequirement, opponentRecoveryPlan, escalationPolicy.

Falsification requires required=true, a minimum challenge depth, and a counterexample requirement.

Independence requires a minimum independence rule, exclusion of private Solver context, and mandatory pre-result Opponent start.

Admission succeeds only when the mission/objective/acceptance are complete, risk is set, exactly one primary Solver and Opponent are eligible, independence/recovery policies are satisfiable, downstream execution resolves through the canonical runtime, and no competing authority is introduced. Otherwise ADMISSION = REJECT and no partial admission reaches execution.

## 6. NATIVE OPPOSITION

The task primitive is ONE TASK + ONE PRIMARY SOLVER + ONE PRIMARY OPPONENT.

Backups are recovery roles, not additional simultaneous primaries.

Solver constructs the solution, produces claims/evidence, responds to challenges, and never certifies or adjudicates its own dispute.

Opponent constructs falsification challenges, searches for counterexamples, records disproof evidence, and never certifies or becomes the sole source of final truth.

## 7. OPPONENT INDEPENDENCE — TARGET

Shared context may contain task, objective, constraints, acceptance criteria, and approved relevant evidence.

Private reasoning, temporary Solver plans, unverified hypotheses, and private Solver context are not automatically shared.

Required order:
ADMISSION
→ ASSIGNMENT
→ SOLVER gets shared context
→ OPPONENT gets shared context
→ OPPONENT records initial challenge
→ INDEPENDENT START LOCK
→ controlled exchange

The independent-start event must precede Solver-result disclosure and must have visible immutable ordering proof.

## 8. OPPOSITION PLAN — TARGET

attackSurface = where the solution is most exposed to failure.

falsificationQuestions = questions capable of disproving the claim or acceptance.

expectedCounterexamples = known/generated cases expected to fail when the claim is wrong.

evidenceThatWouldDisproveSuccess = observable proof that forces reject/rework/escalate.

independenceRequirement = minimum separation of identities/context/evidence/execution assumptions.

opponentRecoveryPlan = bounded recovery for unavailable/stuck/invalid Opponent output.

escalationPolicy = deterministic conditions for replan/escalation/dispute.

## 9. SOLVE ⇄ FALSIFY

CLAIM → COUNTERCLAIM → EVIDENCE → RESPONSE → RECONCILIATION

Provenance preserves claimId, counterclaimId, evidenceIds, taskId, solverId, opponentId, candidateSha, sequence, and timestamps. Neither side may erase or rewrite the other's recorded evidence.

## 10. CONFLICT ARBITRATION — TARGET

Arbitration is a function of the existing Control Plane/Governance path, not a new authority seat.

CLAIM → COUNTERCLAIM → EVIDENCE → ARBITRATION → DISPOSITION

Allowed dispositions:
RESOLVED, MORE_EVIDENCE, REPLAN, ESCALATE, DISPUTED.

Solver cannot adjudicate its own disputed claim. Opponent cannot turn its own rejection into certification. Material disputes cannot be silently discarded.

## 11. OPPONENT vs RED TEAM — TARGET

Opponent attacks during construction. Red Team attacks a frozen Candidate at handoff.

Red Team challenges hidden assumptions, evidence quality, missed attack surfaces, interaction/correlation failures, security/governance bypasses, and false-green conditions.

Red Team is a review stage, never a certification authority.

## 12. VERIFICATION and CERTIFICATION boundaries

CANDIDATE
→ RED TEAM
→ INDEPENDENT VERIFICATION
→ CERTIFICATION

Verifier independently checks result, artifact, evidence, exact-SHA binding, and unsupported claims.

Certification maps to existing Governance/certification mechanisms. CELL cannot merge or promote outside existing repository governance.

## 13. ASSIGNMENT ENGINE — TARGET

The Assignment Engine is a decision module inside the canonical Control Plane/Planner path.

Inputs include mission, task, risk class, required capabilities, constraints, acceptance criteria, opposition policy, available agent profiles, independence requirements, and recovery policy.

Outputs bind:
taskId, missionId, solverId, opponentId, backupSolverId, backupOpponentId, riskClass, oppositionPlan, falsificationPolicy, verificationPolicy, independencePolicy.

Selection is capability-aware, risk-aware, evidence-aware, independence-aware, recovery-aware, deterministic, and fail-closed.

## 14. PAIR LOCK and RECOVERY

Active pair binding includes Solver/Opponent identities, risk class, policies, and recovery rules.

FAILURE
→ CAPTURE
→ CLASSIFY
→ USE BACKUP IF POLICY ALLOWS
→ RE-ESTABLISH INDEPENDENT START
→ RESUME OR REPLAN

If backup activation changes material independence, admission/assignment checks run again.

## 15. CANDIDATE contract — TARGET

Candidate requires Solver result, Opponent challenge position, completed required challenge exchange, dispositioned conflicts, required evidence, stable exact candidate SHA, and a complete handoff package.

Candidate is never equivalent to Solver success and remains rejectable by Red Team and Verifier.

## 16. LEARNING and FRONTIER — TARGET

Only verified/certified results may become reusable CELL knowledge.

Unverified Solver ideas, unresolved Opponent disputes, and historical designs cannot become promoted canonical knowledge.

Frontier produces bounded new work/hypotheses and returns through canonical task admission. It is not an authority layer.

## 17. Runtime authority non-duplication

Assignment remains inside the canonical Control Plane/Planner.
Capability lookup remains TOOL_REGISTRY / TOOL_CATALOG.
Capability/tool execution remains delegated to the canonical executor.
Verifier remains the independent verification authority.
Certification/promotion uses existing Governance/branch protection.

No CELL stage bypasses admission, output contracts, capability verification, exact-SHA evidence, or repository governance.

## 18. Historical classification map

| Item | Classification |
|---|---|
| 200-bot CELL pool | HISTORICAL / SUPERSEDED |
| Personal bot-memory swarm | HISTORICAL |
| Historical multiple registries | SUPERSEDED / REJECTED |
| Historical executor registries/workflow runners | SUPERSEDED / REJECTED |
| Historical public agent/provider gateway | HISTORICAL / REJECTED for current MVP |
| TOOL_REGISTRY / TOOL_CATALOG | CURRENT |
| Canonical executor | CURRENT |
| Verifier | CURRENT |
| Governance / branch protection | CURRENT |
| Native Solver/Opponent assignment | TARGET |
| Opposition Plan | PROPOSED |
| Arbitration | PROPOSED/TARGET |
| Red Team handoff | TARGET |
| Frontier loop | TARGET |

## 19. Implementation handoff

Required future outcomes:
- admission schema + validator;
- assignment state and recovery;
- restricted Opponent context;
- independent-start proof;
- claim/counterclaim/evidence provenance;
- arbitration transitions;
- Candidate/Red Team handoff;
- exact-SHA verification;
- governance certification mapping;
- promotion state;
- learning/frontier transitions;
- regression tests for authority cardinality and fail-closed behavior.

No implementation may add another registry, dispatcher, executor, verifier, or certification authority.

## 20. CURRENT vs TARGET vs HISTORICAL

CURRENT:
deterministic Control Plane, canonical capability registry/catalog, canonical executor, output contracts, capability verifier, exact-SHA evidence discipline, existing Governance/branch protection.

TARGET/PROPOSED:
native Solver/Opponent admission, Opposition Plan enforcement, independent-start proof, arbitration, Candidate→Red Team closure, CELL certification mapping, learning/frontier lifecycle.

HISTORICAL/SUPERSEDED:
legacy multi-agent pools, competing registries/executors, provider-controlled execution architectures, historical certification assertions without current exact-SHA proof.

## 21. EXIT CRITERIA

The architecture is structurally complete when there is one canonical flow, zero duplicate invariant IDs, zero conflicting CURRENT flows, clear Solver/Opponent contract, clear Red-Team boundary, clear arbitration model, and clear CURRENT/TARGET/HISTORICAL status.

Runtime gaps intentionally remain open until executable proof closes them.

## 22. EXACT SHA and CHANGE CONTROL

Pre-change baseline:
de1e5b3c46bc1f5812987cb8ad863c5ff983178d

Final commit SHA and final file blob SHA must be read back from GitHub after write; never inferred.

Future edits must preserve the single canonical flow and INV-CELL-### namespace, classify changed assertions, never mark TARGET/PROPOSED as CURRENT without executable evidence, never add a competing authority seat, and never erase historical contradiction.

## 23. Publication status

This publication does not claim full CELL runtime closure.

The current execution branch now contains executable Assignment/Delegation infrastructure and an Opponent independent-start proof on exact SHA, while Admission, Arbitration, Candidate/Red Team, certification mapping, learning, and Frontier remain TARGET/PROPOSED pending independent implementation and evidence.
