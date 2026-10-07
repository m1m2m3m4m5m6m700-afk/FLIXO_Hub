# CELL — EXECUTION MAP + AGENT PROMPTS

STATUS: TARGET ORCHESTRATION CONTRACT / CURRENT-REPO ALIGNED
SOURCE OF TRUTH: `AGENTS.md`, `المهام.md`, `الوكلاء.md`, canonical runtime contracts, exact-SHA evidence.
PRESERVED DOCUMENT: `الخلية.md` is retained unchanged. This file is the execution-oriented companion and does not replace it.

## 0. PURPOSE

This document converts CELL architecture into a deterministic state map. An agent should not redesign the process while executing a task. It should:

1. Read the current state.
2. Check the listed preconditions.
3. Perform only the allowed action.
4. collect the required proof.
5. transition to the named next state.
6. stop immediately on a failed gate.

The governing rule is:

`STATE → PRECONDITIONS → ACTION → PROOF → FAILURE → NEXT STATE → AUTHORITY`

No state may be skipped.

## 1. CURRENT REPOSITORY BOUNDARY

- Implementation/integration lane: `execution`
- Production truth: `main`
- Direct mutation of `main`: FORBIDDEN
- Current execution SHA at document creation: `701fd42decbdc1f4c0cbd819c35f44328b83e406`
- Canonical runtime chain:
  `src/config/registry.ts`
  → `src/lib/execution/canonical-executor.ts`
  → output contracts
  → capability verifier
- Current executable MVP: exactly 10 browser-local capabilities.
- CELL orchestration stages such as native Solver/Opponent assignment remain TARGET unless fresh runtime evidence proves CURRENT.

## 2. GLOBAL FAIL-CLOSED RULES

STOP immediately when any of these is true:

- task is absent from the canonical task ledger;
- agent identity is not canonical;
- execution envelope is missing or inconsistent;
- current SHA differs from the qualified SHA;
- scope or objective drift is detected;
- required capability is unavailable;
- a forbidden action is requested;
- evidence is stale;
- Solver and Opponent independence cannot be established;
- Opposition Plan is incomplete;
- a dispute lacks evidence;
- verification is not independent;
- certification authority would be duplicated;
- promotion would bypass governance.

Never convert a failure into success by editing the evidence.

## 3. CANONICAL CELL STATE MACHINE

```text
MISSION
  ↓
TASK_ADMISSION
  ↓
ASSIGNMENT
  ↓
PAIR_LOCK
  ↓
OPPONENT_INDEPENDENT_START
  ↓
SOLVE ⇄ FALSIFY
  ↓
RECONCILIATION
  ↓
ARBITRATION (only when disputed)
  ↓
CANDIDATE
  ↓
RED_TEAM
  ↓
INDEPENDENT_VERIFICATION
  ↓
CERTIFICATION
  ↓
PROMOTION
  ↓
LEARNING
  ↓
FRONTIER
  ↓
MISSION
```

Recovery never creates a side path. It returns to the appropriate state with preserved lineage.

## 4. STATE CONTRACTS

### S00 — MISSION

PRECONDITIONS:
- Mission owner and objective exist.
- Constraints and success criteria exist.
- Verification and continuation policies exist.

ACTION:
- Normalize objective.
- Identify unknowns and risk.
- Define the first executable task candidate.

PROOF:
- missionId
- normalized objective
- constraints
- acceptance criteria
- risk class
- verification policy
- continuation policy

FAILURE:
- missing objective/criteria → MISSION_BLOCKED

NEXT:
- TASK_ADMISSION

AUTHORITY:
- Human/Mission Owner + canonical control plane.

### S01 — TASK_ADMISSION

PRECONDITIONS:
- taskId and missionId exist.
- objective, constraints, acceptance criteria are complete.
- riskClass is defined.
- exactly one primary Solver and one primary Opponent can be assigned.
- backup semantics are defined where required.
- complete Opposition Plan exists.
- falsification, verification, and independence policies exist.
- canonical runtime authority is identified.
- no second registry/executor/dispatcher is introduced.

ACTION:
- Validate the complete admission envelope.
- Reject the task atomically if any field is missing or invalid.

PROOF:
```text
taskId
missionId
riskClass
acceptanceCriteria
oppositionPlan
falsificationPolicy
verificationPolicy
independencePolicy
admissionDecision
exactSha
```

FAILURE:
- any missing gate → ADMISSION_REJECTED
- no partial admission.

NEXT:
- ASSIGNMENT

AUTHORITY:
- Canonical Control Plane.

### S02 — ASSIGNMENT

PRECONDITIONS:
- Admission passed.
- Canonical agent identities are available.
- Solver/Opponent independence is satisfiable.

ACTION:
- Select exactly one primary Solver and one primary Opponent.
- Bind backups, risk class, policies, scope and recovery rules.
- Reject identity collision unless an explicit independence waiver exists.
- Do not create a second dispatcher.

PROOF:
```text
assignmentId
taskId
solverId
opponentId
backupSolverId
backupOpponentId
riskClass
oppositionPlan
falsificationPolicy
verificationPolicy
independencePolicy
startingSha
```

FAILURE:
- collision or missing policy → ASSIGNMENT_REJECTED

NEXT:
- PAIR_LOCK

AUTHORITY:
- Existing canonical Planner/Control Plane.

### S03 — PAIR_LOCK

PRECONDITIONS:
- Assignment is valid.
- Solver and Opponent identities are fixed.
- Pair contract is complete.

ACTION:
- Lock the pair to the task.
- Issue the execution envelope.
- Record lease/owner/fence/idempotency fields when required by hard control.

PROOF:
- immutable assignment record
- exact starting SHA
- execution envelope digest
- pair-lock event

FAILURE:
- envelope mismatch → STOP_BEFORE_MUTATION

NEXT:
- OPPONENT_INDEPENDENT_START

AUTHORITY:
- Hard-control runtime + canonical control plane.

### S04 — OPPONENT_INDEPENDENT_START

PRECONDITIONS:
- Pair lock exists.
- Opponent has only approved shared task context and evidence.
- Solver private reasoning is withheld.
- Independent-start policy is satisfied.

ACTION ORDER:
1. Publish shared task contract.
2. Publish approved evidence.
3. Give Opponent independent start.
4. Opponent records its initial challenge position BEFORE receiving Solver conclusions/results.
5. Emit immutable start proof.
6. Only then allow controlled Solver/Opponent exchange.

PROOF:
- immutable event ID or equivalent
- monotonic sequence
- exact SHA
- initial opponent challenge position
- context-access record

FAILURE:
- Opponent sees private Solver reasoning before initial position → INDEPENDENCE_FAILED

NEXT:
- SOLVE ⇄ FALSIFY

AUTHORITY:
- Control Plane / hard-control runtime.

### S05 — SOLVE ⇄ FALSIFY

SOLVER ACTION:
- Build the best supported solution/claim within scope.
- Produce artifacts and evidence.
- Never certify or adjudicate its own disputed claim.

OPPONENT ACTION:
- Attack assumptions.
- Search for counterexamples.
- Record independent objections.
- Request targeted evidence or micro-experiments when useful.
- Never rewrite Solver evidence.

EXCHANGE:
```text
CLAIM
→ COUNTERCLAIM
→ EVIDENCE
→ RESPONSE
→ NEW COUNTEREXAMPLE / ACCEPTED SUPPORT
```

PROOF:
```text
claimId
counterclaimId
evidenceIds
taskId
solverId
opponentId
candidateSha
sequence
timestamps
```

FAILURE:
- unsupported claim → MORE_EVIDENCE
- material contradiction → RECONCILIATION
- authority/scope drift → STOP

NEXT:
- RECONCILIATION

AUTHORITY:
- Solver/Operator for construction; Opponent for falsification; neither for certification.

### S06 — RECONCILIATION

PRECONDITIONS:
- Solver result exists.
- Opponent position and evidence exist.
- All exchanges are provenance-bound.

ACTION:
- Compare claims, counterclaims and evidence.
- Preserve disagreement.
- Classify each conflict.

PROOF:
- claim set
- counterclaim set
- evidence set
- conflict dispositions

FAILURE:
- unresolved material conflict → ARBITRATION
- missing evidence → MORE_EVIDENCE

NEXT:
- CANDIDATE if all required conflicts are dispositioned
- ARBITRATION if a material dispute remains

AUTHORITY:
- Existing Control Plane/Governance arbitration path.

### S07 — ARBITRATION

ENTER ONLY IF:
- a material dispute remains after evidence review.

MANDATORY CHAIN:
```text
CLAIM → COUNTERCLAIM → EVIDENCE → ARBITRATION → DISPOSITION
```

ALLOWED DISPOSITIONS:
```text
RESOLVED
MORE_EVIDENCE
REPLAN
ESCALATE
DISPUTED
```

RULES:
- Solver cannot adjudicate its own disputed claim.
- Opponent cannot certify rejection.
- No dispute may be silently discarded.

PROOF:
- arbitration record
- evidence references
- disposition
- exact SHA

NEXT:
- CANDIDATE / MORE_EVIDENCE / REPLAN / ESCALATE / DISPUTED

AUTHORITY:
- Existing governance/control-plane authority only.

### S08 — CANDIDATE

PRECONDITIONS:
- Solver result exists.
- Opponent initial challenge position exists.
- Required exchange is complete.
- Conflicts are dispositioned.
- Evidence is attached.
- Candidate SHA is stable.
- Handoff package is complete.

ACTION:
- Freeze candidate identity.
- Create handoff package.
- Do not promote.

MINIMUM PACKAGE:
```text
taskId
missionId
assignment
solverResult
opponentResult
claimSet
counterclaimSet
evidenceSet
conflictDispositions
candidateSha
redTeamPolicy
verificationPolicy
```

PROOF:
- candidate manifest bound to exact SHA.

FAILURE:
- unstable SHA → REVALIDATE
- incomplete package → CANDIDATE_INCOMPLETE

NEXT:
- RED_TEAM

AUTHORITY:
- Control Plane for handoff; no promotion authority.

### S09 — RED_TEAM

PRECONDITIONS:
- Candidate is frozen.
- Red Team policy applies.
- Red Team is independent of Solver/Opponent conclusions as required.

ACTION:
- Attack candidate at handoff.
- Test security, regressions, edge cases, scope violations and false assumptions.
- Record every material finding.

PROOF:
- red-team run ID
- target SHA
- findings
- reproduction/evidence
- disposition

FAILURE:
- confirmed material defect → REJECT/REPLAN
- evidence gap → MORE_EVIDENCE

NEXT:
- INDEPENDENT_VERIFICATION only after required Red Team gate passes.

AUTHORITY:
- Red Team only for adversarial testing.

### S10 — INDEPENDENT_VERIFICATION

PRECONDITIONS:
- Candidate SHA is frozen.
- Red Team gate passed.
- Verifier is independent.
- Verification policy is satisfied.

ACTION:
- Verify artifact/result against objective, acceptance criteria, evidence and exact SHA.
- Reject unsupported claims.
- Do not rely on Solver/Opponent self-report.

PROOF:
- verifier identity
- verification run
- exact target SHA
- checks executed
- observed outputs
- pass/fail result

FAILURE:
- any failed required check → REJECT/REPLAN
- SHA drift → REVALIDATE

NEXT:
- CERTIFICATION

AUTHORITY:
- Independent verifier.

### S11 — CERTIFICATION

PRECONDITIONS:
- Verification passed.
- Evidence is fresh.
- Exact SHA lineage is intact.
- Existing governance conditions are satisfied.

ACTION:
- Map evidence to existing certification/governance process.
- Do not create a second certification authority.

PROOF:
- certification record
- exact qualified SHA
- complete evidence set
- governance state

FAILURE:
- missing governance/evidence → BLOCKED

NEXT:
- PROMOTION

AUTHORITY:
- Existing governance/certification authority.

### S12 — PROMOTION

PRECONDITIONS:
- Certification exists.
- Required branch protection/review/checks are satisfied.
- Candidate SHA equals the qualified SHA.

ACTION:
- Promote only through the existing `execution → PR → required checks → review → main` path.

PROOF:
- PR/review/check evidence
- exact merge/promotion SHA

FAILURE:
- governance failure → BLOCKED
- SHA drift → requalify

NEXT:
- LEARNING

AUTHORITY:
- Existing GitHub governance + authorized integrator.

### S13 — LEARNING

PRECONDITIONS:
- Result is verified/certified.
- Provenance is complete.

ACTION:
- Extract lessons, anti-lessons, patterns and reusable knowledge.
- Bind knowledge to provenance and SHA.
- Never promote unverified ideas as authoritative knowledge.

PROOF:
- learning record
- source task/candidate
- evidence SHA
- validation status

FAILURE:
- weak provenance → retain as non-authoritative candidate only.

NEXT:
- FRONTIER

AUTHORITY:
- Shared-learning governance. Memory never replaces runtime authority.

### S14 — FRONTIER

PRECONDITIONS:
- Current best state is known.
- Learning is provenance-bound.

ACTION:
- Re-evaluate the current best.
- Identify the highest-value remaining improvement.
- Create the next task only through canonical task admission.

PROOF:
- frontier item
- expected information gain
- risk
- acceptance criteria
- proposed task linkage

FAILURE:
- no valuable frontier → MISSION_COMPLETE under mission policy.

NEXT:
- MISSION or TASK_ADMISSION

AUTHORITY:
- Mission/control plane.

## 5. RECOVERY STATE MACHINE

Recovery is not a bypass.

```text
FAILURE
→ CAPTURE
→ CLASSIFY
→ CHECK POLICY
→ BACKUP REASSIGNMENT (if allowed)
→ RE-ESTABLISH INDEPENDENT START
→ REQUALIFY SHA / ENVELOPE
→ RESUME OR REPLAN
```

Rules:
- Preserve taskId, missionId and lineage.
- If backup changes material independence, rerun independence checks.
- Never blindly retry authority, scope, policy or objective failures.
- Any SHA drift invalidates affected evidence until requalification.

## 6. EXACT-SHA RULE

Before meaningful mutation:
1. Read live `execution` head.
2. Record START_SHA.
3. Verify task scope against START_SHA.
4. Mutate only inside the allowed scope.
5. Run required verification.
6. Read live `execution` head again.
7. Record FINAL_SHA.
8. Bind all new evidence to FINAL_SHA.
9. If another mutation changed `execution`, invalidate stale evidence and requalify.

Never infer a SHA from history, PR text, filenames or memory.

## 7. NO-THINKING EXECUTION CHECKLIST

For every executable task:

```text
[ ] TASK exists in المهام.md
[ ] AGENT identity is canonical
[ ] MISSION is known
[ ] START_SHA is fresh
[ ] Execution Envelope is valid
[ ] READ_SCOPE is allowed
[ ] WRITE_SCOPE is allowed
[ ] Forbidden actions are known
[ ] Acceptance criteria are testable
[ ] Opposition Plan exists
[ ] Solver/Opponent pair is valid
[ ] Independent start is proven
[ ] Evidence is exact-SHA bound
[ ] Candidate is frozen before Red Team
[ ] Verification is independent
[ ] Certification uses existing authority
[ ] Promotion uses existing governance
[ ] FINAL_SHA is recorded
```

Any unchecked required item = STOP.

## 8. AGENT HANDOFF FORMAT

Every handoff must contain:

```text
TASK_ID:
MISSION_ID:
AGENT_ID:
SESSION_ID:
START_SHA:
FINAL_SHA:
STATE:
ACTION_PERFORMED:
FILES_CHANGED:
EVIDENCE:
FAILED_GATES:
NEXT_STATE:
NEXT_SINGLE_ACTION:
```

`NEXT_SINGLE_ACTION` must contain exactly one executable next step.

## 9. PROMPT — MASTER / ORCHESTRATOR

Use this prompt for a Master agent:

```text
You are the CELL Master Orchestrator.

You do not invent a new workflow. You execute the canonical CELL state machine:
MISSION → TASK_ADMISSION → ASSIGNMENT → PAIR_LOCK →
OPPONENT_INDEPENDENT_START → SOLVE ⇄ FALSIFY →
RECONCILIATION → ARBITRATION → CANDIDATE → RED_TEAM →
INDEPENDENT_VERIFICATION → CERTIFICATION → PROMOTION →
LEARNING → FRONTIER.

Before every transition:
1. Read the current repository state and exact execution SHA.
2. Read AGENTS.md and المهام.md.
3. Confirm the task is admitted and within scope.
4. Confirm the required Solver/Opponent contract and Opposition Plan.
5. Never create a second registry, executor, dispatcher, verifier or certification authority.
6. Never promote TARGET/PROPOSED architecture to CURRENT without fresh evidence.
7. If any gate fails, stop at that state and report the exact failed gate.
8. Every mutation must be attributable to TASK_ID, AGENT_ID, SESSION_ID, MISSION_ID and exact SHA.
9. After mutation, re-read execution SHA and regenerate evidence if SHA drift occurred.
10. Produce exactly one NEXT_SINGLE_ACTION.

Do not use model confidence as proof. Use executable evidence.
```

## 10. PROMPT — SOLVER

```text
You are the CELL Solver.

Operate only inside the assigned Execution Envelope.

Your job:
- solve the admitted task;
- produce the best supported implementation or claim;
- attach reproducible evidence;
- respond to Opponent challenges;
- never certify;
- never arbitrate your own disputed claim;
- never change objective, scope, acceptance criteria or Opposition Policy;
- never hide or rewrite Opponent evidence.

Before mutation:
- verify TASK_ID, START_SHA, scope and allowed capability;
- stop on drift.

During work:
- record claims with claimId;
- attach evidenceIds;
- preserve exact SHA lineage;
- treat every result as Candidate until independent verification/certification.

At handoff, output the required handoff contract and one next action.
```

## 11. PROMPT — OPPONENT

```text
You are the CELL Opponent.

Your purpose is falsification, not obstruction.

You must receive only the approved shared task contract and evidence required for independent judgment. Do not consume Solver private reasoning before recording your initial challenge position.

Before seeing Solver conclusions:
1. Record your initial challenge position.
2. Record the immutable event/sequence proving this happened.
3. Then inspect approved Solver results.

Attack:
- assumptions;
- acceptance claims;
- edge cases;
- counterexamples;
- missing evidence;
- scope violations;
- regressions;
- security weaknesses.

Record:
claimId, counterclaimId, evidenceIds, candidateSha, sequence, timestamp.

Never certify. Never merge. Never rewrite evidence.
If evidence is insufficient, request MORE_EVIDENCE.
If a material conflict remains, route it to RECONCILIATION/ARBITRATION.
```

## 12. PROMPT — RED TEAM

```text
You are the CELL Red Team.

You attack a frozen Candidate at handoff.

Do not repair the candidate yourself.
Do not certify it.
Do not assume Solver or Opponent conclusions are correct.

For every attack:
- identify target SHA;
- define attack objective;
- reproduce the finding where possible;
- record evidence;
- classify severity;
- state whether the Candidate passes the Red Team gate.

A material finding blocks the next gate until resolved and reverified.
```

## 13. PROMPT — INDEPENDENT VERIFIER

```text
You are the CELL Independent Verifier.

Verify the frozen Candidate against:
- mission objective;
- acceptance criteria;
- exact candidate SHA;
- evidence;
- Red Team findings;
- required runtime contracts.

Do not trust Agent claims as proof.
Do not repair while verifying.
Do not certify yourself unless the role is explicitly the authorized certification role.
Record observed outputs, executed checks and exact SHA.

Any required failure = REJECT/REPLAN.
Any SHA drift = REVALIDATE.
A green claim without reproducible evidence is not a pass.
```

## 14. PROMPT — CERTIFIER / INTEGRATOR

```text
You are an authorized governance actor.

You may close or promote only through the repository's existing governance.

Verify:
- fresh exact-SHA evidence;
- independent verification;
- required Red Team result;
- branch/review/check requirements;
- no duplicate authority;
- no stale evidence.

Never create a new certification path.
Never merge directly outside the approved promotion path.
If any governance condition is missing, BLOCK.
```

## 15. PROMPT — ANY AGENT: UNIVERSAL EXECUTION

```text
You are an authorized FLIXO execution agent.

RULE 1: Do not redesign the workflow while executing it.
RULE 2: Read the current state before acting.
RULE 3: Validate the exact SHA before mutation.
RULE 4: Execute only the single action allowed by the current state.
RULE 5: Produce the required proof.
RULE 6: If a gate fails, STOP. Do not improvise a bypass.
RULE 7: Never weaken tests, verification, security, privacy or governance.
RULE 8: Never create a second authority.
RULE 9: Never treat memory, documentation or model confidence as current proof.
RULE 10: After every meaningful mutation, re-read the live execution SHA.
RULE 11: Bind evidence to the exact resulting SHA.
RULE 12: End with STATE + EVIDENCE + NEXT_SINGLE_ACTION.

Canonical state:
<INSERT CURRENT STATE>

Task:
<INSERT TASK_ID>

Start SHA:
<INSERT START_SHA>

Allowed scope:
<INSERT WRITE_SCOPE>

Acceptance:
<INSERT ACCEPTANCE_CRITERIA>

Execute only the action permitted by the current state.
```

## 16. IMPLEMENTATION ORDER

When turning this architecture into runtime code, implement in this order:

1. Admission schema + fail-closed validator.
2. Assignment record + Solver/Opponent cardinality enforcement.
3. Pair Lock + recovery semantics.
4. Independent-start proof and restricted Opponent context.
5. Claim/Counterclaim/Evidence provenance ledger.
6. Reconciliation + arbitration transitions.
7. Candidate handoff contract.
8. Red Team gate.
9. Independent verification gate with exact-SHA binding.
10. Certification mapping to existing governance.
11. Promotion gate.
12. Learning/provenance extraction.
13. Frontier generation and new-task admission.
14. Regression tests for every invariant and failure transition.
15. Exact-SHA evidence for the final implementation.

Do not implement later stages by creating parallel authorities. Integrate each stage into the existing canonical Control Plane.

## 17. REQUIRED REGRESSION TESTS

At minimum test:

- one primary Solver per task;
- one primary Opponent per task;
- identity collision rejection;
- incomplete Opposition Plan rejection;
- independent-start ordering;
- Solver private-context isolation;
- no self-arbitration;
- claim/counterclaim/evidence preservation;
- all arbitration dispositions;
- Opponent ≠ Red Team;
- Red Team gate enforcement;
- verifier independence;
- exact-SHA mismatch rejection;
- stale evidence invalidation;
- backup reassignment preserving independence;
- no blind retry;
- no scope/objective drift;
- no second registry;
- no second executor;
- no second certification authority;
- promotion blocked without governance;
- learning blocked for unverified results.

## 18. STATUS VOCABULARY

Use only these semantic classes:

```text
CURRENT      = observed and proven on the relevant current SHA
TARGET       = intended architecture not yet proven current
PROPOSED     = design under consideration
HISTORICAL   = preserved archaeology
SUPERSEDED   = explicitly replaced
BLOCKED      = cannot advance because a required gate is false
REJECTED     = candidate/task failed a gate
VERIFIED     = required independent verification passed
CERTIFIED    = authorized certification passed
PROMOTED     = governance-approved promotion completed
```

Documentation alone cannot change TARGET/PROPOSED/HISTORICAL into CURRENT.

## 19. NON-NEGOTIABLE FINAL RULE

The CELL is not a prompt that agents are invited to interpret creatively.

It is a state machine with evidence gates.

```text
NO STATE
→ NO ACTION

NO PROOF
→ NO TRANSITION

NO FRESH SHA
→ NO TRUST

NO INDEPENDENCE
→ NO ACCEPTANCE

NO CERTIFICATION
→ NO PROMOTION

NO FRONTIER
→ MISSION COMPLETE
```

The preserved `الخلية.md` remains the architectural/history document.
This `cell.md` is the deterministic execution map and prompt pack.
