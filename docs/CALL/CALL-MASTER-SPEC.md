# CALL Master Specification

Status: IMPLEMENTED CONTRACT v1.0

CALL executes real objectives through a governed multi-agent cell. It does not invent work to keep agents busy.

## Master Plan Template

Every mission plan MUST contain: Objective, Why, Non-goals, ordered execution steps, required evidence, opposition plan, exit criteria, policy version/hash, and starting SHA.

The Master may plan, assign, retry, substitute agents, reconcile, and request escalation. It may not rewrite policy, certify its own work, promote to production, or convert an escalation into approval.

## Plan disposition

Master Plan → Master Opponent → Policy Kernel → Disposition.

The Policy Kernel is deterministic policy enforcement, not an additional executive authority.

Objection classes: STRUCTURAL, EVIDENCE_GAP, SECURITY, SCOPE, FEASIBILITY, POLICY, SHA_INTEGRITY, INDEPENDENCE, BUDGET, CONTRADICTION.

## Mission lifecycle

OBJECTIVE_QUEUED → MASTER_PLAN_DRAFT → MASTER_OPPONENT_REVIEW → APPROVED → ASSIGNMENTS_LOCKED → AGENTS_RUNNING → RECONCILIATION → CANDIDATE_BUNDLE → RED_TEAM → VERIFIED_BUNDLE

The existing CELL lifecycle remains the canonical execution-control contract underneath this orchestration layer. CALL does not create another executor.

## Escalation

Replan, switch agent, split task, or retry first. Escalate only for policy contradiction, policy revision, governance change, production promotion authority, critical security incident, canonical boundary conflict, or exhausted recovery policy.

ESCALATED cannot be converted to APPROVED by the Master.

## Candidate handoff

A Candidate Bundle binds: patch.diff, evidence.json, redteam-report.md, verifier-report.md, source-sha.txt. Execution applies the patch to its own current lineage and reruns canonical tests. CALL never directly merges into execution or main.

## Objective discipline

NO OBJECTIVE → NO WORK. Finished missions consume an existing queued objective/frontier item or wait.

## Workspace and cost policy

Each agent receives an isolated workspace, preferably a Git worktree inside an isolated container. Agent credentials must not include push-capable production tokens. Default recovery limits are 3 retries per failure class, repeated plan hashes are a plan loop, and mission cost/duration are bounded by admission.

## Evidence and learning

Solver → Claim → Opponent → Counterclaim → Evidence → Reconciliation → Candidate → Red Team → Independent Verification. Only promoted verified knowledge enters Cell Memory. XP requires evidence and disposition references. Memory and XP are append-only.

## Authority boundary

Human Authority owns policy and production governance. CALL Master coordinates. Agents research/implement. Opponent falsifies. Red Team attacks frozen candidates. Verifier independently verifies. Existing canonical execution and repository governance remain authoritative.
