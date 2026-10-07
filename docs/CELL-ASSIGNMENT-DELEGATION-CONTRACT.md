# CELL — ASSIGNMENT & DELEGATION ARCHITECTURE

Status: IMPLEMENTED REFERENCE CONTRACT
Version: 1.1.0

المهام.md يبقى Dispatch Authority الوحيد. هذه الطبقة تصف وتتحقق من قرار الإسناد والتسليم ولا تنشئ طابور تكليف موازيًا.

## 1. Assignment Decision

TASK → REQUIREMENTS → ROUTING → ASSIGNMENT → HANDOFF → EXECUTION

العوامل:

Capability Fit + Artifact Fit + Risk Fit + Availability + Reliability + Evidence Quality + Context Fit + Recovery Quality + Information Gain - Failure/Cost penalties

الناتج للمهمة المهمة:

PRIMARY SOLVER + BACKUP SOLVER + OPPONENT + BACKUP OPPONENT + INDEPENDENT VERIFIER + ESCALATION

في المهام التي تتطلب استقلالًا، لا يجوز أن يكون الـVerifier هو الـPrimary أو الـBackup.

## 2. Task Ledger vs Progress Ledger

TASK LEDGER = objective + constraints + dependencies + dispatch

PROGRESS LEDGER = observations + evidence + blockers + stalls + nextAction

Progress Ledger لا ينشئ Task، ولا يغير Dispatch Authority، ولا يغير صلاحيات Agent. هو سجل ملاحظات يسمح بإعادة تقييم Assignment.

## 3. Agent Performance Memory

ملف/حالة الأداء تدخل routing كإشارات قابلة للقياس:

reliability, verificationStrength, contextFit, recoveryQuality, recentFailureRate, falsePositiveRate, falseGreenHistory, availability, costRate, informationGain

لا تُمنح هذه الذاكرة سلطة certification أو dispatch.

## 4. Assignment Quartet

Primary Solver
Backup Solver
Independent Verifier
Escalation Target

المهمة لا تمتلك Agent؛ Assignment هو نقطة الارتباط القابلة للتبديل.

## 5. Spawn / Delegate

spawn ينشئ Subtask ذات subtaskId مستقل مرتبط بـparentTaskId.

delegate يرسل Typed Handoff إلى Agent مصرح به.

وهذا يفصل بقاء Task الأم عن جلسة Agent مؤقتة.

## 6. Delegation Authorization Graph

الاتصال directional:

A → B لا يعني B → A.

كل حافة تحدد:

taskTypes + riskClasses + maxDepth + maxActiveSubtasks + maxCost + maxDuration

أي غياب للحافة أو تجاوز حد = REJECT.

## 7. Typed Handoff

العقد يحمل:

handoffId, taskId, parentTaskId, assignmentId, sourceAgentId, targetAgentId, reason, objective, inputRefs, requiredCapabilities, expectedOutput, verificationCriteria, readScope, writeScope, startingSha, currentSha, deadlineAtMs, budget, evidenceRequirements, returnContract

الهاندوف ذو SHA غير مطابق للحالة الحالية يرفض fail-closed، ويجب أن تتطابق task/session/assignment/type/risk مع طلب التفويض.

## 8. Agent Swapping

Task ≠ Agent

Assignment #1 → failure → Assignment #2 → Assignment #3

تاريخ الإسنادات يبقى جزءًا من Progress/Evidence lineage.

## 9. Stall-triggered Routing

ON_TRACK → CONTINUE

SLOW → REASSIGN

STALLED(first) → REASSIGN

STALLED(repeated) → REPLAN

BLOCKED → ESCALATE

Progress Ledger هنا يصبح مدخل قرار routing وليس سجلًا وصفيًا فقط.

## 10. Delegation Budgets

maxDelegationDepth
maxActiveSubtasks
maxDelegationCost
maxDelegationTime

تجاوزها = REJECT → REPLAN.

## 11. Artifact-centric Routing

المخرج المتوقع جزء من اختيار Agent:

ARCHITECTURE-MAP → architecture capability
EXECUTABLE-PATCH → implementation capability
COUNTEREXAMPLE → falsification capability
CERTIFICATION-EVIDENCE → independent verification capability

## 12. Runtime Boundary

المرجع الحالي deterministic وtestable. الإنتاج الدائم يحتاج لاحقًا:

1. persistence للـAssignment/Progress مع version/CAS.
2. idempotent handoff creation.
3. lease مرتبط بـassignmentId.
4. recovery يحفظ assignment lineage.
5. scheduler يستهلك progress لكن يظل dispatch عبر المهام.md projection فقط.
6. SHA freshness لكل assignment/handoff مؤثر على code.
7. metrics لتقييم routing quality وstall recovery وagent swapping.

## 13. Authority Rule

المهام.md = Dispatch Authority
الوكلاء.md = Agent Identity Authority
CELL assignment contract = Routing Semantics
Evidence = Factual Authority
Certification/Governance = Promotion Authority

لا Supervisor ولا Registry ولا Task Ledger ثانٍ يحصل على سلطة مستقلة.