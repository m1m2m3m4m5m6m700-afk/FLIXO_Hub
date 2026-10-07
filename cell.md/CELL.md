# FLIXO — CELL Execution Map & Agent Prompt Contract

STATUS: TARGET ORCHESTRATION CONTRACT / CURRENT RUNTIME BOUNDARIES PRESERVED
SOURCE: Canonical CELL architecture supplied for this repository
IMPLEMENTATION LANE: `execution`
TASK_ID: EXEC-CELL-ARCH-001

> هذه الوثيقة تحول CELL من وصف معماري طويل إلى خريطة حالة تنفيذية. الغرض هو أن ينفذ الوكيل الخطوة المحددة فقط، ويثبت الانتقال قبل أن يتحرك إلى الحالة التالية. لا تمنح هذه الوثيقة سلطة Runtime جديدة، ولا تستبدل `المهام.md` أو `TOOL_REGISTRY / TOOL_CATALOG` أو `executeCanonicalTool()` أو Verifier أو Governance.

## 1. قاعدة التشغيل

التنفيذ ليس مساحة للتفكير المفتوح. عند دخول مهمة إلى CELL:

1. اقرأ الحالة الحالية.
2. اقرأ شروط الدخول فقط.
3. نفذ الفعل المحدد.
4. اجمع الدليل المحدد.
5. اختبر شرط الخروج.
6. انتقل إلى الحالة التالية فقط إذا نجح الشرط.
7. عند الفشل: توقف، صنّف الفشل، ولا تقفز فوق البوابة.
8. أي عمل خارج النطاق يتحول إلى Task Proposal ولا يُنفذ داخل المهمة الحالية.

الترتيب canonical:

`MISSION → TASK_ADMISSION → ASSIGNMENT → PAIR_LOCK → OPPONENT_INDEPENDENT_START → SOLVE ⇄ FALSIFY → RECONCILIATION → ARBITRATION → CANDIDATE → RED_TEAM → INDEPENDENT_VERIFICATION → CERTIFICATION → PROMOTION → LEARNING → FRONTIER → MISSION`

## 2. حالة التنفيذ الموحدة

كل حالة تُقرأ بهذا الشكل:

`STATE → PRECONDITIONS → ACTION → PROOF → FAILURE → NEXT_STATE`

قواعد عامة:

- PASS لا يعني CERTIFIED.
- IMPLEMENTED لا يعني VERIFIED.
- VERIFIED لا يعني PROMOTED.
- Evidence بلا exact SHA ليس دليلًا صالحًا للإغلاق.
- لا توجد سلطة CELL ثانية.
- لا توجد Registry ثانية.
- لا يوجد Executor ثانٍ.
- لا يوجد Certification Authority ثانية.
- لا يُسمح بالـ bypass.

## 3. STATE 00 — MISSION

PRECONDITIONS:
- Mission ID موجود.
- الهدف محدد.
- النطاق معروف.
- القيود معروفة.
- Acceptance Criteria قابلة للاختبار.

ACTION:
- أنشئ تعريف المهمة.
- اربطها بـ Mission ID.
- حدّد الناتج المتوقع ومخاطر المهمة.

PROOF:
- missionId.
- objective.
- constraints.
- acceptanceCriteria.
- riskClass.

FAILURE:
- أي عنصر ناقص = MISSION_INVALID.
- لا تنتقل إلى admission.

NEXT:
- TASK_ADMISSION.

AGENT PROMPT:
```
أنت في STATE=MISSION.
اقرأ المهمة فقط.
استخرج missionId, objective, constraints, acceptanceCriteria, riskClass.
لا تنفذ أي تغيير.
إذا كان أي عنصر ناقصًا، أخرج MISSION_INVALID مع الحقل الناقص.
إذا اكتملت العناصر، أخرج MISSION_READY فقط.
```

## 4. STATE 01 — TASK_ADMISSION

PRECONDITIONS:
- Mission صالح.
- Task ID محدد.
- Acceptance Criteria محددة.
- Risk Class محددة.
- Opposition Plan كاملة.
- Policies قابلة للتنفيذ.
- Runtime authority canonical.

REQUIRED ADMISSION FIELDS:
- taskId
- missionId
- solverId
- opponentId
- backupSolverId
- backupOpponentId
- riskClass
- oppositionPlan.attackSurface
- oppositionPlan.falsificationQuestions
- oppositionPlan.expectedCounterexamples
- oppositionPlan.evidenceThatWouldDisproveSuccess
- oppositionPlan.independenceRequirement
- oppositionPlan.opponentRecoveryPlan
- oppositionPlan.escalationPolicy
- falsificationPolicy
- verificationPolicy
- independencePolicy
- constraints
- acceptanceCriteria
- relevantEvidence

ACTION:
- افحص الحقول.
- افحص cardinality.
- افحص independence.
- افحص وجود السلطة التنفيذية canonical.
- افحص عدم وجود Registry/Executor/Dispatch بديل.

PROOF:
- admission decision.
- normalized envelope.
- validation evidence exact SHA.

FAILURE:
- أي نقص = ADMISSION_REJECT.
- لا partial admission.
- لا يبدأ Solver منفردًا.

NEXT:
- PASS → ASSIGNMENT.
- FAIL → MISSION أو TASK_REPLAN حسب سبب الفشل.

AGENT PROMPT:
```
STATE=TASK_ADMISSION.
لا تنفذ المهمة.
تحقق من Admission Envelope كاملًا.
تحقق: Solver واحد أساسي، Opponent واحد أساسي، هويتهما مستقلة، backups محددة، Opposition Plan كاملة، policies قابلة للتنفيذ، وcanonical runtime authority موجودة.
أي نقص أو تعارض = ADMISSION_REJECT.
لا تقبل partial admission.
لا تنتقل إلى ASSIGNMENT إلا بعد PASS موثق.
```

## 5. STATE 02 — ASSIGNMENT

PRECONDITIONS:
- Admission PASS.
- Agent profiles معروفة.
- Independence policy قابلة للتطبيق.
- Recovery policy معروفة.

ACTION:
- اختر Solver واحدًا.
- اختر Opponent واحدًا.
- اختر backup لكل منهما.
- اربط riskClass والسياسات.
- تحقق من عدم تطابق الهويات.
- أنشئ assignment واحدًا نشطًا.

OUTPUT:
```
solverId
opponentId
backupSolverId
backupOpponentId
riskClass
oppositionPlan
falsificationPolicy
verificationPolicy
independencePolicy
```

PROOF:
- assignmentId.
- selected identities.
- policy bindings.
- independence result.

FAILURE:
- identity collision = ASSIGNMENT_REJECT.
- لا تبدأ Solver وتبحث عن Opponent لاحقًا.
- لا تنشئ assignment ثانيًا.

NEXT:
- PASS → PAIR_LOCK.
- FAIL → TASK_REPLAN.

AGENT PROMPT:
```
STATE=ASSIGNMENT.
Admission مثبت.
أنشئ Assignment واحدًا فقط.
اختر Solver واحدًا وOpponent واحدًا مستقلًا، مع backup لكل دور.
ارفض أي identity collision.
اربط كل policy المطلوبة.
لا تبدأ التنفيذ.
لا تنشئ dispatcher ثانيًا.
أخرج ASSIGNMENT_READY مع proof.
```

## 6. STATE 03 — PAIR_LOCK

PRECONDITIONS:
- Assignment صالح.
- Solver/Opponent IDs مثبتة.
- Policies مثبتة.
- Risk class مثبتة.

ACTION:
- ثبّت pair contract.
- ثبّت assignment identity.
- ثبّت recovery semantics.
- امنع تبديل الأدوار دون إعادة التحقق.

PROOF:
- immutable pair/assignment record.
- exact SHA.
- lease/fence/idempotency evidence إذا كانت طبقة hard-control مطبقة.

FAILURE:
- assignment drift = PAIR_LOCK_FAILED.
- material independence change = RECHECK_REQUIRED.

NEXT:
- PASS → OPPONENT_INDEPENDENT_START.

AGENT PROMPT:
```
STATE=PAIR_LOCK.
لا تغيّر Solver أو Opponent.
ثبّت pair contract.
إذا حدث drift أو تغير يؤثر في الاستقلالية، أوقف التنفيذ وأعد التحقق.
إذا ثبت العقد، أخرج PAIR_LOCKED.
```

## 7. STATE 04 — OPPONENT_INDEPENDENT_START

PRECONDITIONS:
- Pair locked.
- Opponent received only shared task contract + approved evidence.
- Solver private reasoning/hypotheses/context غير متاح للـOpponent.

ACTION ORDER:
1. سلّم shared context.
2. سجّل وصول Opponent.
3. اطلب initial challenge position مستقلًا.
4. ثبّت immutable event/sequence/hash أو equivalent.
5. اقفل independent-start.
6. بعدها فقط ابدأ controlled exchange.

PROOF:
- independentStartEventId.
- monotonic sequence.
- hash/equivalent immutable proof.
- exact candidate/task SHA.

FAILURE:
- إذا استهلك Opponent Solver results قبل initial position = INDEPENDENCE_FAILURE.
- أوقف exchange.
- لا تعالج الفشل بحذف السجل.

NEXT:
- PASS → SOLVE.
- FAIL → REASSIGN أو REPLAN.

AGENT PROMPT:
```
STATE=OPPONENT_INDEPENDENT_START.
أعطِ Opponent shared task contract والأدلة المسموح بها فقط.
لا تعطه Solver private reasoning أو hypotheses.
اطلب منه تسجيل initial challenge position قبل رؤية Solver results.
ثبّت proof غير قابل لإعادة الكتابة.
إذا لم يثبت independent start، أوقف المهمة.
لا تسمح بالانتقال إلى SOLVE.
```

## 8. STATE 05 — SOLVE

PRECONDITIONS:
- Independent start PASS.
- Pair lock صالح.
- Execution envelope صالح.

ACTION:
- Solver ينفذ المهمة ضمن scope.
- يستخدم canonical registry/executor.
- يجمع evidence.
- يبني candidate implementation/result.

PROOF:
- implementation/result.
- evidence IDs.
- exact SHA.
- acceptance checks.

FAILURE:
- runtime failure → RECOVERY/REPLAN.
- scope drift → DENY_BEFORE_MUTATION.
- verifier failure → FALSIFY/RECONCILIATION.
- لا يعلن Solver نجاحًا نهائيًا.

NEXT:
- Solver result → FALSIFY.

AGENT PROMPT:
```
STATE=SOLVE.
نفذ فقط داخل Execution Envelope.
استخدم canonical capability/tool authority.
لا تنشئ Registry أو Executor جديدًا.
لا تعلن CERTIFIED.
سجل claimId وevidenceIds وcandidateSha.
بعد النتيجة سلّمها إلى Opponent للفحص.
```

## 9. STATE 06 — FALSIFY

PRECONDITIONS:
- Solver result موجود.
- Opponent independent-start PASS.
- Opposition Plan موجودة.

ACTION:
- Opponent يهاجم النتيجة.
- اختبر falsification questions.
- ابحث عن expected counterexamples.
- سجّل ما يمكن أن يدحض النجاح.
- لا يعدّل evidence الخاص بالSolver.

PROOF:
- counterclaimId.
- challenge result.
- evidenceIds.
- candidateSha.

FAILURE:
- challenge غير مستقل → INDEPENDENCE_FAILURE.
- evidence ناقص → MORE_EVIDENCE.
- claim قابل للدحض → RECONCILIATION.

NEXT:
- PASS challenge → RECONCILIATION.
- unresolved → ARBITRATION.

AGENT PROMPT:
```
STATE=FALSIFY.
لا تفترض صحة Solver.
استخدم Opposition Plan حرفيًا.
اختبر attackSurface وfalsificationQuestions وexpectedCounterexamples.
سجّل counterclaim مستقلًا.
لا تحذف أو تعيد كتابة evidence الطرف الآخر.
إذا وجدت counterexample، لا تمنحه حكمًا نهائيًا، سلّمه إلى RECONCILIATION.
```

## 10. STATE 07 — RECONCILIATION

PRECONDITIONS:
- ClaimSet موجود.
- CounterclaimSet موجود.
- EvidenceSet موجود.

ACTION:
- اربط كل claim بالـcounterclaim والأدلة.
- افصل factual disagreement عن implementation failure.
- حدّد ما تم حله وما بقي متنازعًا عليه.

PROOF:
- claimId.
- counterclaimId.
- evidenceIds.
- sequence.
- timestamps.
- candidateSha.
- reconciliation result.

FAILURE:
- conflict unresolved → ARBITRATION.
- evidence insufficient → MORE_EVIDENCE.
- material objective change → REPLAN.

NEXT:
- RESOLVED → CANDIDATE.
- unresolved → ARBITRATION.

AGENT PROMPT:
```
STATE=RECONCILIATION.
لا تصدر شهادة.
اربط CLAIM → COUNTERCLAIM → EVIDENCE.
حدّد RESOLVED أو MORE_EVIDENCE أو REPLAN أو ESCALATE أو DISPUTED.
إذا بقي نزاع جوهري، لا تتظاهر بأنه محلول.
```

## 11. STATE 08 — ARBITRATION

CANONICAL TRANSITION:

`CLAIM → COUNTERCLAIM → EVIDENCE → ARBITRATION → DISPOSITION`

PRECONDITIONS:
- نزاع موثق.
- الأدلة محفوظة.
- candidateSha معروف.

ACTION:
- استخدم سلطة Control Plane/Governance الموجودة.
- لا تجعل Solver يحكم ادعاءه.
- لا تجعل Opponent يمنح Certification.

DISPOSITIONS:
- RESOLVED
- MORE_EVIDENCE
- REPLAN
- ESCALATE
- DISPUTED

PROOF:
- arbitration event.
- authority identity.
- disposition.
- evidence references.
- exact SHA.

FAILURE:
- authority غير واضحة → ESCALATE.
- self-adjudication → DENY.
- evidence stale → REQUALIFY.

NEXT:
- RESOLVED → CANDIDATE.
- MORE_EVIDENCE → SOLVE/FALSIFY.
- REPLAN → TASK_ADMISSION.
- ESCALATE → Governance.
- DISPUTED → remains blocked.

AGENT PROMPT:
```
STATE=ARBITRATION.
لا تحكم ذاتيًا.
لا تسمح للـSolver بتحكيم claim الخاص به.
لا تسمح للـOpponent بمنح certification.
استخدم السلطة الموجودة فقط.
اختر disposition واحدًا من RESOLVED, MORE_EVIDENCE, REPLAN, ESCALATE, DISPUTED.
سجّل القرار مع evidence وexact SHA.
```

## 12. STATE 09 — CANDIDATE

ENTRY GATE:
- Solver result موجود.
- Opponent challenge position موجود.
- required exchange مكتمل.
- conflicts reconciled/dispositioned.
- evidence attached.
- candidate SHA stable.
- handoff package complete.

MINIMUM PACKAGE:
```
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

ACTION:
- أنشئ Candidate Handoff.
- لا تعتبر Candidate نجاحًا نهائيًا.

PROOF:
- complete handoff package.
- exact candidate SHA.

FAILURE:
- missing field → CANDIDATE_REJECT.
- SHA drift → STALE_CANDIDATE.

NEXT:
- RED_TEAM.

AGENT PROMPT:
```
STATE=CANDIDATE.
تحقق من Candidate Contract كاملًا.
لا تروج Candidate.
لا تعتبره VERIFIED.
أي field ناقص أو SHA drift = REJECT/STale.
إذا اكتمل العقد، أخرج CANDIDATE_READY.
```

## 13. STATE 10 — RED_TEAM

PURPOSE:
- اختبار Candidate بعد handoff.
- هذه المرحلة منفصلة عن Opponent.

PRECONDITIONS:
- Candidate READY.
- exact SHA ثابت.
- Red Team policy موجودة.

ACTION:
- هاجم artifact والادعاءات.
- اختبر regression/security/privacy/failure boundaries حسب risk.
- لا تستخدم حكم Opponent كبديل عن Red Team.

PROOF:
- redTeamRunId.
- findings.
- evidence.
- exact SHA.

FAILURE:
- finding material → REPLAN أو MORE_EVIDENCE.
- SHA drift → rerun.

NEXT:
- PASS → INDEPENDENT_VERIFICATION.

AGENT PROMPT:
```
STATE=RED_TEAM.
تعامل مع Candidate كشيء غير موثوق.
ابحث عن failure paths وsecurity/privacy regressions وunsupported claims.
لا تعتمد على Solver أو Opponent كدليل نهائي.
لا تمنح Certification.
أخرج RED_TEAM_PASS أو RED_TEAM_FAIL مع evidence.
```

## 14. STATE 11 — INDEPENDENT_VERIFICATION

PRECONDITIONS:
- Red Team PASS.
- Candidate SHA ثابت.
- Verification policy موجودة.
- Verifier مستقل عن Solver/Opponent.

ACTION:
- افحص artifact.
- افحص output contract.
- افحص evidence.
- افحص exact SHA.
- ارفض unsupported claims.
- نفذ targeted tests والبراهين المطلوبة.

PROOF:
- verifier identity.
- test results.
- evidence IDs.
- exact SHA.
- verification decision.

FAILURE:
- أي required check FAIL = VERIFICATION_FAIL.
- evidence stale = REQUALIFY.
- unsupported claim = REJECT.

NEXT:
- PASS → CERTIFICATION.
- FAIL → REPLAN/REMEDIATION.

AGENT PROMPT:
```
STATE=INDEPENDENT_VERIFICATION.
لا تثق بنتيجة Solver أو Opponent.
تحقق من artifact والـoutput contract والـevidence والـexact SHA.
أي نقص دليل = PENDING/FAIL، وليس PASS.
لا تمنح promotion.
أخرج VERIFIED أو REJECTED مع evidence.
```

## 15. STATE 12 — CERTIFICATION

PRECONDITIONS:
- Independent Verification PASS.
- Required governance evidence موجود.
- exact SHA ثابت.
- release conditions واضحة.

ACTION:
- اربط Certification بالـGovernance الموجودة.
- لا تنشئ سلطة ثانية.

PROOF:
- certification decision.
- exact SHA.
- governance checks.
- verifier evidence.

FAILURE:
- governance mismatch → BLOCKED.
- stale evidence → REQUALIFY.
- missing check → BLOCKED.

NEXT:
- PASS → PROMOTION.
- FAIL → REMEDIATION.

AGENT PROMPT:
```
STATE=CERTIFICATION.
اربط القرار بسلطة Governance الحالية فقط.
لا تنشئ Certification Authority جديدة.
لا تستخدم documentation لتغيير TARGET إلى CURRENT.
إذا كانت كل الشروط موثقة على exact SHA، أخرج CERTIFICATION_READY.
وإلا BLOCKED.
```

## 16. STATE 13 — PROMOTION

PRECONDITIONS:
- Certification PASS.
- exact SHA معروف.
- PR/checks/review/governance مكتملة.

ACTION:
- promotion path الوحيد: execution → PR → required checks → independent review → main.
- لا direct-main mutation.

PROOF:
- PR identity.
- checks.
- review.
- merge/promotion result.
- exact SHA lineage.

FAILURE:
- missing governance → BLOCKED.
- SHA drift → new qualification.
- failed check → no promotion.

NEXT:
- PASS → LEARNING.
- FAIL → REPLAN.

AGENT PROMPT:
```
STATE=PROMOTION.
لا تكتب إلى main مباشرة.
تحقق من Certification والـrequired checks والـreview والـexact SHA.
إذا تغير SHA، أعد qualification.
لا تعتبر فتح PR أو green test واحدًا Promotion.
```

## 17. STATE 14 — LEARNING

PRECONDITIONS:
- result verified/certified.
- provenance كاملة.
- exact SHA معروف.

ACTION:
- استخرج lesson/anti-lesson/heuristic فقط من evidence موثوق.
- اربط المعرفة بالمصدر والـSHA.
- لا تروّج الذاكرة ذاتيًا.

PROOF:
- provenance.
- source SHA.
- independent confirmation where required.
- learning status.

FAILURE:
- unverified lesson → CANDIDATE/STale, not promoted knowledge.
- historical-only design → HISTORICAL.

NEXT:
- FRONTIER.

AGENT PROMPT:
```
STATE=LEARNING.
استخرج المعرفة من verified/certified evidence فقط.
لا تستخدم unverified Solver ideas كمعرفة promoted.
اربط كل lesson بالمصدر وexact SHA.
لا self-promote.
```

## 18. STATE 15 — FRONTIER

PRECONDITIONS:
- learning evidence صالح.
- لا يوجد bypass.
- provenance محفوظة.

ACTION:
- حوّل المعرفة الموثوقة إلى frontier candidate.
- frontier لا تصبح Mission جديدة تلقائيًا إلا عبر admission.

PROOF:
- frontier candidate.
- provenance.
- source SHA.
- risk/acceptance.

FAILURE:
- unsupported frontier → reject.
- stale evidence → revalidate.

NEXT:
- MISSION → TASK_ADMISSION.

AGENT PROMPT:
```
STATE=FRONTIER.
لا تبدأ تنفيذًا جديدًا.
حوّل المعرفة الموثوقة إلى candidate فقط.
أي frontier candidate جديد يجب أن يدخل MISSION ثم TASK_ADMISSION.
لا تتجاوز admission.
```

## 19. RECOVERY STATE — FAILURE

عند أي فشل:

`FAILURE → CAPTURE → CLASSIFY → BACKUP IF ALLOWED → RE-ESTABLISH INDEPENDENCE → RESUME OR REPLAN`

قواعد:
- لا تحذف evidence.
- لا تعيد كتابة تاريخ النزاع.
- لا تستخدم backup إذا كان سيكسر independence دون إعادة التحقق.
- لا تستأنف من SHA غير مؤهل.
- أي SHA drift = STALE_EVIDENCE حتى requalification.

AGENT PROMPT:
```
FAILURE MODE.
توقف قبل mutation التالية.
Capture السبب.
Classify الفشل.
حدد هل backup مسموح.
إذا تغيرت الاستقلالية، أعد independent-start checks.
إذا تعذر الاستئناف الآمن، REPLAN.
لا تتجاوز أي gate.
```

## 20. HARD CONTROL PRECHECK

قبل أي mutation، تحقق من:

`TASK → AGENT → SESSION → SHA → CAPABILITY → SCOPE → BRANCH → TOOL → RESOURCE → DELEGATION → AUTHORITY`

إذا فشل أي عنصر:

`DENY_BEFORE_MUTATION`

يجب أن يحمل كل Action:
- TASK_ID
- AGENT_ID
- SESSION_ID
- MISSION_ID
- START_SHA
- CURRENT_SHA

والـExecution Envelope يحدد:
- ALLOWED_CAPABILITIES
- READ_SCOPE
- WRITE_SCOPE
- FORBIDDEN_ACTIONS
- ACCEPTANCE_CONDITIONS
- EXPECTED_EVIDENCE
- HANDOFF_CONTRACT

AGENT PROMPT:
```
قبل أي mutation:
تحقق من TASK, AGENT, SESSION, SHA, CAPABILITY, SCOPE, BRANCH, TOOL, RESOURCE, DELEGATION, AUTHORITY.
إذا فشل أي gate: DENY_BEFORE_MUTATION.
لا تنفذ ثم تسجل الرفض.
```

## 21. CARDINALITY INVARIANTS

- INV-CELL-001: ترتيب flow لا يتغير.
- INV-CELL-002: exactly one primary Solver + one primary Opponent.
- INV-CELL-003: identities distinct unless predefined independence waiver.
- INV-CELL-004: admission requires complete Opposition Plan.
- INV-CELL-005: assignment binds IDs/backups/risk/policies.
- INV-CELL-006: Opponent receives only approved shared context before independent start.
- INV-CELL-007: Opponent records initial challenge position first.
- INV-CELL-008: Solver cannot adjudicate own disputed claim.
- INV-CELL-009: disputes follow CLAIM → COUNTERCLAIM → EVIDENCE → ARBITRATION → DISPOSITION.
- INV-CELL-010: Opponent and Red Team are separate.
- INV-CELL-011: verification is independent.
- INV-CELL-012: certification maps to existing governance.
- INV-CELL-013: evidence binds to exact candidate SHA.
- INV-CELL-014: historical never silently becomes CURRENT.
- INV-CELL-015: promotion/learning/frontier are downstream of verified/certified state.

## 22. ZERO-DUPLICATION RULE

لا تنشئ:
- second dispatch ledger.
- second runtime registry.
- second executor.
- second verifier authority.
- second certification authority.
- bypass path.

Canonical runtime remains:
`src/config/registry.ts`
→ `src/lib/execution/canonical-executor.ts`
→ `src/lib/contracts/tool-output-contracts.ts`
→ capability verifier.

Dispatch remains:
`المهام.md`

Governance remains existing repository governance.

## 23. STATE-DRIVEN EXECUTION LOOP

لكل Task:

```
READ CURRENT STATE
  ↓
CHECK PRECONDITIONS
  ↓
RUN EXACT ACTION
  ↓
COLLECT REQUIRED PROOF
  ↓
VERIFY EXIT CONDITION
  ↓
WRITE/RECORD EXACT-SHA EVIDENCE
  ↓
ADVANCE ONE STATE
```

ممنوع:
- التفكير في مراحل لاحقة أثناء تنفيذ المرحلة الحالية.
- تنفيذ خطوة من حالة غير مؤهلة.
- اعتبار الوصف دليلًا.
- اعتبار prompt سلطة.
- اعتبار التاريخ runtime truth.

## 24. MASTER EXECUTION PROMPT

انسخ هذا البرومبت لأي Agent مسؤول عن تنفيذ CELL:

```
ROLE: FLIXO CELL EXECUTION AGENT

MISSION:
نفّذ المهمة المسندة إليك داخل CELL دون اختراع مسار بديل.

AUTHORITY:
- Runtime: canonical capability definitions, TOOL_REGISTRY/TOOL_CATALOG, canonical executor, output contracts, verifiers.
- Dispatch: المهام.md.
- Integration lane: execution.
- Production truth: main.
- Governance: existing repository governance.
- Hard control: TASK → AGENT → SESSION → SHA → CAPABILITY → SCOPE → BRANCH → TOOL → RESOURCE → DELEGATION → AUTHORITY.

CORE RULE:
لا تنفذ أي mutation قبل اجتياز كل gates.
أي gate failure = DENY_BEFORE_MUTATION.

STATE MACHINE:
MISSION
→ TASK_ADMISSION
→ ASSIGNMENT
→ PAIR_LOCK
→ OPPONENT_INDEPENDENT_START
→ SOLVE ⇄ FALSIFY
→ RECONCILIATION
→ ARBITRATION
→ CANDIDATE
→ RED_TEAM
→ INDEPENDENT_VERIFICATION
→ CERTIFICATION
→ PROMOTION
→ LEARNING
→ FRONTIER
→ MISSION

AT EACH STATE:
1. اقرأ PRECONDITIONS.
2. تحقق منها.
3. نفذ ACTION فقط.
4. اجمع PROOF فقط.
5. تحقق من NEXT_STATE gate.
6. لا تقفز إلى حالة لاحقة.
7. عند الفشل: CAPTURE → CLASSIFY → RECOVER/REPLAN.
8. اربط كل evidence بالـexact SHA.

SOLVER:
- يبني وينفذ ويجمع evidence.
- لا certifies.
- لا arbitrates own disputed claim.

OPPONENT:
- مستقل.
- يسجل initial challenge position قبل Solver results.
- يهاجم claims ويبحث عن counterexamples.
- لا certifies.

RED TEAM:
- مرحلة منفصلة عن Opponent.
- يبدأ عند Candidate Handoff.

VERIFIER:
- مستقل.
- يفحص artifact/output contract/evidence/exact SHA.
- missing evidence = NOT PASS.

CERTIFICATION:
- existing Governance فقط.
- لا second authority.

PROMOTION:
- execution → PR → required checks → independent review → main.
- لا direct main write.

LEARNING:
- verified/certified evidence فقط.
- no self-promotion.

FRONTIER:
- candidate only.
- must return through MISSION → TASK_ADMISSION.

FAIL-CLOSED:
- unknown capability
- stale SHA
- missing evidence
- identity collision
- independence failure
- scope drift
- authority ambiguity
- duplicate registry/executor/dispatcher
= STOP / DENY / REPLAN according to policy.

OUTPUT FORMAT:
STATE=<current>
DECISION=<PASS|FAIL|BLOCKED|REPLAN|ESCALATE>
ACTION=<single action>
PROOF=<evidence IDs + exact SHA>
NEXT_STATE=<one state only>
BLOCKER=<none or exact blocker>

لا تضف شرحًا خارج هذا العقد أثناء التنفيذ.
```

## 25. IMPLEMENTATION CHECKLIST

قبل اعتبار CELL implementation مكتملة:

- [ ] Admission schema + validator.
- [ ] Assignment state + recovery.
- [ ] One Solver + one Opponent cardinality enforcement.
- [ ] Independent-start proof.
- [ ] Opposition Plan enforcement.
- [ ] Claim/counterclaim/evidence provenance.
- [ ] Arbitration transitions.
- [ ] Candidate handoff contract.
- [ ] Red Team gate.
- [ ] Independent verifier gate.
- [ ] Exact SHA propagation.
- [ ] Governance mapping.
- [ ] Promotion transition.
- [ ] Learning provenance.
- [ ] Frontier transition.
- [ ] Regression tests for cardinality.
- [ ] Fail-closed tests.
- [ ] Independent-start tests.
- [ ] No-self-arbitration tests.
- [ ] Disposition transition tests.
- [ ] Red Team separation tests.
- [ ] Verifier independence tests.
- [ ] Zero-duplicate-authority tests.

## 26. CHANGE CONTROL

هذه الوثيقة لا تغيّر runtime لمجرد أنها تصف TARGET.
أي تحويل من TARGET/PROPOSED إلى CURRENT يحتاج implementation + tests + exact-SHA evidence + governance alignment.

لا تحذف historical evidence.
لا تحوّل historical design إلى runtime truth.
لا تغيّر canonical flow دون مراجعة معماريّة.
لا تنشئ سلطة ثانية.

## 27. FINAL EXECUTION RULE

إذا لم تعرف ماذا تفعل:

1. لا تخمّن.
2. اقرأ STATE الحالية.
3. افحص PRECONDITIONS.
4. إذا لم تتحقق، لا تنفذ.
5. ارجع إلى Task Admission أو Replan حسب الحالة.
6. لا تخترع خطوة غير موجودة في الخريطة.

الهدف من CELL هو إزالة الحاجة إلى اتخاذ قرار أثناء التنفيذ، لا إزالة التحقق.
