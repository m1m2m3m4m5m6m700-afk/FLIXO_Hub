# CELL — HARD CONTROL / EXECUTION FIREWALL CONTRACT

Status: IMPLEMENTED REFERENCE CONTRACT
Version: 1.0.0

الـPrompt طبقة Soft Control فقط. السلطة الفعلية تأتي من Runtime Hard Control.

## Control chain

MISSION
→ TASK LEDGER
→ TASK CONTRACT
→ ASSIGNMENT ENGINE
→ EXECUTION ENVELOPE
→ CAPABILITY GATE
→ SCOPE GATE
→ AUTHORITY GATE
→ TOOL / FILE / BRANCH FIREWALL
→ EXECUTION
→ CONTINUOUS ACTION MONITOR
→ PROGRESS / RESOURCE MONITOR
→ EVIDENCE
→ ACCEPTANCE
→ CERTIFICATION
→ CLOSURE

## Core rules

Agent intent != Agent authority
Agent prompt != Agent permission
Agent claim != Agent progress
Agent output != Accepted result

الوكيل حر في اختيار طريقة الحل داخل الـEnvelope، وغير مخول بتوسيع objective أو scope أو authority أو budgets.

## Immutable execution envelope

عند claim يجب أن يشمل الـEnvelope على الأقل:

TASK_ID
AGENT_ID
MISSION_ID
SESSION_ID
START_SHA
ALLOWED_CAPABILITIES
READ_SCOPE
WRITE_SCOPE
ALLOWED_BRANCH
FORBIDDEN_ACTIONS
NORMALIZED_OBJECTIVE_ID
EXPECTED_OUTPUT
ACCEPTANCE_CONDITIONS
EVIDENCE_REQUIREMENTS
TIME_BUDGET
COST_BUDGET
MAX_DELEGATION_DEPTH
HANDOFF_POLICY
ESCALATION_POLICY
ACCEPTANCE_DIGEST

يُنشأ الـEnvelope ككائن immutable runtime، وتُرفض أي عملية لا تطابق هويته.

## Pre-execution identity test

قبل أي Action:

1. Correct Agent
2. Correct Task
3. Correct Session
4. Correct Mission
5. Correct Branch
6. Correct Start SHA
7. Correct Capability
8. Correct Objective
9. Correct Expected Output
10. Current SHA present and live

كل من START_SHA وCURRENT_SHA يجب أن يكون SHA كاملًا من 40 خانة hex؛ لا تُقبل قيم placeholder أو معرفات نصية. START_SHA يجب أن يطابق SHA القبول/assignment، وCURRENT_SHA يجب أن يطابق live execution SHA عند الـRuntime.

فشل أي عنصر = BLOCK / QUARANTINE وفق نوع الانحراف.

## Action firewall

كل action يحمل:

ACTION_ID
TASK_ID
AGENT_ID
SESSION_ID
MISSION_ID
START_SHA
CURRENT_SHA
OPERATION
PATH
CAPABILITY
TOOL_ID
ESTIMATED_COST
EXPECTED_DURATION
DELEGATION_DEPTH

CURRENT_SHA إلزامي لكل Action، بما في ذلك READ وTEST، وليس للـmutation فقط. Action بلا CURRENT_SHA يُرفض قبل التنفيذ باعتباره D6_EVIDENCE_DRIFT. وفي Runtime يجب أن يطابق CURRENT_SHA الـlive execution SHA؛ أي اختلاف يجعل الدليل/الفعل stale ويمنع التأثير.

وكل action يمر عبر gate قبل السماح بالتنفيذ.

## Scope firewall

المطابقة path-based وfail-closed:

Task writeScope = src/lib/video/**

write src/lib/video/fixture.ts = ALLOW
write src/lib/security/auth.ts = D1_SCOPE_DRIFT / BLOCK

المسار غير القانوني لا يُسجل فقط؛ يُمنع قبل mutation.

## Branch firewall

كل Envelope يحدد branch واحدًا مسموحًا. `main` مرفوض من مسار Agent execution.

## Capability firewall

امتلاك أداة عامة مثل terminal لا يُساوي امتلاك صلاحية استخدامها لأي هدف. الـAction يحمل capability محددة ويُرفض إذا لم تكن admitted في Envelope.

## Self-expansion prohibition

إذا اكتشف Agent عملاً خارج النطاق:

DISCOVERED_OUT_OF_SCOPE
→ NEW_TASK_PROPOSAL
→ MASTER / DISPATCH AUTHORITY
→ NEW ASSIGNMENT

لا توجد self-expansion mutation.

## Objective firewall

Original Task
→ Normalized Objective
→ Immutable Acceptance Digest

تغيير objective أو acceptance بعد claim = D2_OBJECTIVE_DRIFT.

## Continuous monitoring

التحكم لا ينتهي عند claim. كل Action يعاد فحصه أثناء Session.

المراقبات:

SCOPE MONITOR
PROGRESS MONITOR
BEHAVIOR MONITOR
RESOURCE MONITOR
TEMPORAL MONITOR
EVIDENCE MONITOR

## Progress

activity != progress

Progress Score مبني على verified objective delta وacceptance coverage وrelevant artifacts وverified delta وinformation gain مقابل budget consumed.

انخفاض الدرجة تحت policy threshold = D8_STRATEGY_DRIFT ثم REPLAN/REASSIGN حسب السياسة.

## Drift taxonomy

D1 Scope Drift → HARD BLOCK / PAUSE
D2 Objective Drift → HARD BLOCK / REPLAN
D3 Tool Drift → HARD BLOCK / PAUSE
D4 Resource Drift → HARD BLOCK / PAUSE
D5 Temporal Drift → HARD BLOCK / PAUSE
D6 Evidence Drift → HARD BLOCK / INVALIDATE
D7 Authority Drift → QUARANTINE
D8 Strategy Drift → REVIEW / REPLAN
D9 Delegation Drift → HARD BLOCK / PAUSE
D10 Truth/Memory Drift → HARD BLOCK / INVALIDATE

## Recovery

Drift لا يساوي إسقاط Mission:

DRIFT
→ STOP/PAUSE CURRENT ACTION
→ RECORD FINDING
→ PRESERVE CHECKPOINT
→ REASSESS
→ REASSIGN / REPLAN / RECOVER
→ CONTINUE TASK

Agent failure أو drift لا يمحو Task lineage.

## Runtime ownership

`packages/contracts/src/cell-hard-control.ts` = executable guards
`packages/contracts/src/cell-runtime.ts` = reference runtime enforcement

`الخلية.md` = architecture
`المهام.md` = dispatch authority
`الوكلاء.md` = agent identity authority
Evidence Fabric = factual authority
Certification/Governance = promotion authority

هذه الطبقة لا تمنح نفسها صلاحية Dispatch أو Certification أو Merge.
