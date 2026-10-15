# التنفيذ — الخطة الموحدة للعمل المتبقي

**نوع الملف:** لوحة تنفيذ موحّدة مشتقة من خطط المستودع، وليست سلطة تشغيل أو اعتماد بديلة.  
**تاريخ التجميع:** 2026-10-10  
**الفرع عند الفحص:** execution  
**SHA عند الفحص:** 59b85cce939289f2eb88037f8721688a95abce0a  
**حالة شجرة العمل:** متسخة بتغييرات سابقة كثيرة؛ لم تُنسب هذه التغييرات إلى عملية التجميع ولم تُمسح.

## 1. الغرض ومصدر الحقيقة

هذا الملف يجمع المهام النشطة والفجوات التنفيذية المتبقية التي أمكن استخراجها من سجل المهام وخطة التنفيذ وعقود CELL وحالات Prompts وخارطة الطريق. عند التعارض، تسود سياسات AGENTS.md وضوابط التشغيل الفعلية والعقود المعتمدة.

- FLIXO-Tasks.md هو فهرس dispatch القانوني الحالي. هذه الوثيقة واجهة موحدة للمتابعة وليست فهرس dispatch ثانياً.
- docs/FLIXO-EXECUTION-LEDGER.md وسجلات الحالة القديمة أدلة مرجعية فقط عند اختلاف SHA. لا تُعامل SHA تاريخية على أنها إثبات حالي.
- docs/CELL-CANONICAL-ARCHITECTURE.md يحدد حدود CURRENT وTARGET وHISTORICAL. لا تتحول أي مرحلة TARGET إلى CURRENT بمجرد ذكرها هنا.
- cell.md ملف تنفيذ مشتق، وFLIXO-Cell.md مادة محفوظة/تاريخية واسعة؛ لا تُنشأ منهما سلطة تنفيذ أو سجل مهام موازٍ.
- لا تُحذف ملفات الخطط الأصلية أو السجلات التاريخية ضمن هذا البروتوكول. الحذف المقصود يخص بطاقة المهمة المنجزة من قائمة العمل النشطة فقط.

## 2. بروتوكول دورة حياة المهمة والحذف

1. **اكتشاف وتصنيف:** افحص مصدر المهمة وصنفه TASK أو POLICY أو EVIDENCE أو CANDIDATE أو HISTORICAL أو DEFERRED. لا تحوّل كل توصية أو فقرة معمارية إلى مهمة تنفيذ تلقائياً.
2. **منع التكرار:** قبل إضافة مهمة، ابحث عن TASK_ID أو نطاق مطابق في قائمة FLIXO-Tasks.md وفي هذا الملف. اربط المصدر الجديد بمهمة قائمة إن كان نفس القبول، وإلا سجّله كفجوة مكتشفة غير قابلة للتوزيع حتى اعتماد TASK_ID في السجل القانوني.
3. **خط أساس:** قبل التعديل سجّل branch وHEAD SHA وحالة git status، وحدد التغييرات السابقة. لا تستبدل أو تتراجع عن تغييرات المستخدم ولا تنفذ على main مباشرة.
4. **القبول والتنفيذ:** يجب أن يكون للمهمة TASK_ID ونطاق ومخرج ومعايير قبول وخطوة تالية واحدة. اتبع Execution Envelope وضوابط capability/scope/authority/branch/tool/resource/delegation. لا تمنح الذاكرة أو تعليمات النموذج صلاحية إضافية.
5. **إثبات الاكتمال:** لا تُعد المهمة منجزة بسبب وجود الكود أو الوثيقة فقط. يلزم تحقق المعايير واختبارات مناسبة ونتيجة فعلية ودليل مرتبط بالـSHA الناتج. المهام التي تحتاج مراجعة مستقلة أو بوابة خارجية لا تُغلق دونها.
6. **الحذف من قائمة التنفيذ:** بعد تحقق القبول على SHA الحالي، احذف بطاقة المهمة من قسم «قائمة التنفيذ النشطة» في هذا الملف، وأغلق/أزل بطاقتها من قائمة FLIXO-Tasks.md وفق دورة العمل الموجودة فيه، ثم نفّذ COMMIT وRECOUNT حسب سياسة المستودع. لا تحذف المهمة قبل التحقق.
7. **أثر التدقيق:** قبل حذف البطاقة، أضف إلى «سجل الإغلاق المختصر» سطراً يحتوي TASK_ID وSHA النهائي ومرجع الدليل وتاريخ الإغلاق فقط. هذا سجل إثبات مختصر وليس قائمة مهام نشطة؛ لا تنقل إليه تفاصيل الخطة المحذوفة.
8. **SHA تغيّر أو فشل:** إذا تغير SHA قبل قبول المهمة، تصبح الأدلة القديمة غير كافية ويجب إعادة التحقق. عند الفشل تبقى المهمة مع سبب موثق وخطوة تالية واحدة. لا تخفِ الفشل ولا تضع GREEN/CERTIFIED دون دليل.
9. **المهام المحجوبة:** أبقِ المهمة في القائمة مع BLOCKED/OWNER_ACTION وسبب ودليل محددين. لا تحذفها لمجرد أن العمل يحتاج صلاحية أو إعداداً خارجياً.
10. **حماية المصدر:** لا تحذف ملفات الخطط أو عقود CELL أو سجلات الإغلاق الأصلية تلقائياً؛ هذه الوثيقة تنظّم قائمة التنفيذ ولا تمحو تاريخ القرار أو الدليل.

## 3. قائمة التنفيذ النشطة

القسم التالي منقول من ACTIVE DISPATCH QUEUE في FLIXO-Tasks.md عند SHA المذكور أعلاه. الحالات أدناه هي الحالات المسجلة في المصدر ولم يُعاد إثبات كل حالة من خلال CI في عملية التجميع. يجب إبقاء TASK_ID وNEXT_ACTION ومعايير القبول متسقة مع السجل القانوني.


# ACTIVE DISPATCH QUEUE

**ACTIVE TASK COUNT:** 33
**BASELINE_SHA (at dispatch):** 10d8b862

## P0 — Release / Promotion Critical Path

### EXEC-PR-RECONCILE-001 — التسوية والدمج الموحد لطلبات السحب والربط
- **TASK_ID:** EXEC-PR-RECONCILE-001
- **TYPE:** INTEGRATE
- **PRIORITY:** P0
- **OWNER:** Agent-1 / Integration
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** `.github/workflows/**`, `src/lib/**`, `docs/**`
- **DEPENDS_ON:** none
- **SOURCE:** current execution topology + superseded candidate changes
- **EVIDENCE:** current live execution lineage; historical PR references are historical only
- **ACCEPTANCE:** كل candidate change مصنف mergeable أو superseded وno يوجد مسار دمج مكرر؛ `execution` remains canonical integration base.
- **NEXT_ACTION:** افحص current execution head وPRs مقابل scope البطاقة، ثم حدّث evidence exact-SHA.
- **COLLISION_KEY:** Lane-A1/A2-runtime-integration

### EXEC-VIDEO-FIXTURE-002 — توحيد fixture لعmay video trim
- **TASK_ID:** EXEC-VIDEO-FIXTURE-002
- **TYPE:** IMPLEMENT
- **PRIORITY:** P0
- **OWNER:** Runtime/Media
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** `tests/official/**`, `src/lib/video/**`, `src/tools/video-local/**`
- **DEPENDS_ON:** EXEC-PR-RECONCILE-001
- **SOURCE:** Agent-2 video assurance
- **EVIDENCE:** dynamic fixture evidence exists; exact current-SHA result pending
- **ACCEPTANCE:** one shared fixture/bounds contract؛ fixture duration ≥ 2× max tested trim endpoint؛ no tolerance weakening؛ smoke and deep assurance pass on one SHA.
- **NEXT_ACTION:** شغّل video smoke وdeep assurance على current execution head وسجّل exact-SHA النتيجة.
- **COLLISION_KEY:** Lane-B — video-tests

### EXEC-GOV-AUTOMATED-001 — فحص governance fail-closed
- **TASK_ID:** EXEC-GOV-AUTOMATED-001
- **TYPE:** GOVERNANCE
- **PRIORITY:** P0
- **OWNER:** Agent-Security / Governance
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** `scripts/ci/check-governance.sh`, `scripts/ci/verify-main-ruleset.mjs`, `scripts/ci/verify-live-governance.mjs`, governance tests
- **DEPENDS_ON:** none
- **SOURCE:** live governance policy
- **EVIDENCE:** verifier contract tests; live main ruleset 23854302 is weaker than target and execution ruleset is not confirmed
- **ACCEPTANCE:** verifier fails closed for missing/weak main or execution rulesets and validates PR/review/code-owner/stale/latest-push/thread/strict/release-check controls.
- **NEXT_ACTION:** شغّل verifier بالـGitHub credentials المناسبة وسجّل exact failure set.
- **COLLISION_KEY:** Lane-A2 — governance

### EXEC-GOV-LIVE-001 — تقوية rulesets الحية
- **TASK_ID:** EXEC-GOV-LIVE-001
- **TYPE:** GOVERNANCE
- **PRIORITY:** P0
- **OWNER:** Repository Administrator
- **STATUS:** OWNER_ACTION
- **PR:** n/a
- **SCOPE:** live GitHub rulesets لـmain وexecution؛ no source mutation
- **DEPENDS_ON:** EXEC-GOV-AUTOMATED-001
- **SOURCE:** G0 live governance
- **EVIDENCE:** ruleset 23854302 active but below strict target; execution ruleset must be verified
- **ACCEPTANCE:** main وexecution يفرضان PR review، Code Owners، stale dismissal، latest-push approval، thread resolution، strict required checks، deletion/force-push protection؛ main requires trust-gate وExact-SHA promotion proof.
- **NEXT_ACTION:** طبّق الإعدادات الrequiredة في GitHub Administration ثم أعد verify-live-governance.
- **COLLISION_KEY:** Owner — live-governance

### EXEC-CERT-FINAL-001 — شهادة الإصدار الحالي
- **TASK_ID:** EXEC-CERT-FINAL-001
- **TYPE:** RELEASE
- **PRIORITY:** P0
- **OWNER:** Release/Certification
- **STATUS:** BLOCKED
- **PR:** none
- **SCOPE:** external release attestation + immutable RC evidence references
- **DEPENDS_ON:** EXEC-PR-RECONCILE-001, EXEC-VIDEO-FIXTURE-002, EXEC-GOV-AUTOMATED-001, EXEC-GOV-LIVE-001, EXEC-TESTSPRITE-001
- **SOURCE:** current certification policy
- **EVIDENCE:** none
- **ACCEPTANCE:** exact candidate lineage has current technical/security/browser/coverage/deployment evidence plus independent governance evidence.
- **NEXT_ACTION:** regenerate attestation after every dependency closes.
- **COLLISION_KEY:** Release — certification

### EXEC-PROMOTE-001 — ترقية RC إلى main والتحقق من الإنتاج
- **TASK_ID:** EXEC-PROMOTE-001
- **TYPE:** RELEASE
- **PRIORITY:** P0
- **OWNER:** Release/Promotion
- **STATUS:** QUEUED
- **PR:** none
- **SCOPE:** execution→main promotion PR، promotion proof، deployment identity، production smoke، rollback record
- **DEPENDS_ON:** EXEC-CERT-FINAL-001
- **SOURCE:** G0 Stabilize & Promote
- **EVIDENCE:** none
- **ACCEPTANCE:** promoted head equals qualified RC SHA؛ trust-gate وExact-SHA proof pass؛ deployed SHA equals promoted SHA؛ post-deploy smoke pass؛ rollback reference recorded.
- **NEXT_ACTION:** بعد certification افتح promotion PR وشغّل strict promotion gates مرة واحدة.
- **COLLISION_KEY:** Release — promotion

## CELL HARDENING — P0/P1

### EXEC-CELL-RECOVERY-003 — عزل محاوnoت Replan ومنع stale state
- **TASK_ID:** EXEC-CELL-RECOVERY-003
- **TYPE:** IMPLEMENT
- **PRIORITY:** P0
- **OWNER:** Architecture/Control-Plane
- **STATUS:** VERIFYING
- **PR:** #1214
- **SCOPE:** `packages/contracts/src/cell-lifecycle.ts`, lifecycle contract tests
- **DEPENDS_ON:** EXEC-CELL-CTRL-002
- **SOURCE:** CELL adversarial architecture review
- **EVIDENCE:** replan reset test on current execution lineage
- **ACCEPTANCE:** كل محاولة Replan تبدأ assignment boundary جديدًا؛ no يمكن إعادة استخدام claim/counterclaim/evidence/downstream state من المحاولة السابقة.
- **NEXT_ACTION:** شغّل targeted lifecycle suite على exact resulting SHA وسجّل evidence.
- **COLLISION_KEY:** Lane-G — cell-recovery

### EXEC-CELL-REPLAY-003 — إغnoق replay والتكرار الصريح
- **TASK_ID:** EXEC-CELL-REPLAY-003
- **TYPE:** IMPLEMENT
- **PRIORITY:** P0
- **OWNER:** Architecture/Control-Plane
- **STATUS:** VERIFYING
- **PR:** #1214
- **SCOPE:** `packages/contracts/src/cell-lifecycle.ts`, lifecycle contract tests
- **DEPENDS_ON:** EXEC-CELL-RECOVERY-003
- **SOURCE:** CELL adversarial architecture review
- **EVIDENCE:** explicit solver disclosure and opponent-start duplicate guards
- **ACCEPTANCE:** replay لأي disclosure أو opponent start أو evidence يرفض fail-closed بكود خطأ deterministic.
- **NEXT_ACTION:** وسّع replay matrix لتشمل candidate/certification/verification commands ثم سجّل exact-SHA evidence.
- **COLLISION_KEY:** Lane-G — cell-replay

### EXEC-CELL-INDEPENDENCE-003 — إثبات استقnoل Opponent وVerifier
- **TASK_ID:** EXEC-CELL-INDEPENDENCE-003
- **TYPE:** IMPLEMENT
- **PRIORITY:** P0
- **OWNER:** Architecture/Control-Plane
- **STATUS:** VERIFYING
- **PR:** #1214
- **SCOPE:** `packages/contracts/src/cell-lifecycle.ts`, assignment/lifecycle tests
- **DEPENDS_ON:** EXEC-CELL-REPLAY-003
- **SOURCE:** CELL independence review
- **EVIDENCE:** opponent shared-context hash + timestamp + admission-bound verifier binding
- **ACCEPTANCE:** Opponent context digest وstart timestamp يسجnoن قبل disclosure، والـVerifier الACCEPTED يطابق هوية admission وno يمكنه استخدام identity collision.
- **NEXT_ACTION:** نفّذ targeted lifecycle + assignment independence suites على exact SHA.
- **COLLISION_KEY:** Lane-G — cell-independence

### EXEC-CELL-AUTHORITY-AUDIT-003 — تدقيق عدم وجود Second Authority
- **TASK_ID:** EXEC-CELL-AUTHORITY-AUDIT-003
- **TYPE:** AUDIT
- **PRIORITY:** P0
- **OWNER:** Architecture/Audit
- **STATUS:** VERIFYING
- **PR:** #1214
- **SCOPE:** `src/lib/execution/**`, `src/config/**`, `packages/contracts/src/**`, architecture boundary tests
- **DEPENDS_ON:** EXEC-CELL-INDEPENDENCE-003
- **SOURCE:** CELL authority review
- **EVIDENCE:** canonical execution boundary tests; registry → canonical executor → output contract → verifier chain
- **ACCEPTANCE:** no يوجد executor/registry/promotion/certification authority بديل قابل للتنفيذ، ومسارات MVP النشطة no تتجاوز canonical executor.
- **NEXT_ACTION:** شغّل architecture/boundary audit على exact execution SHA وسجّل كل authority path وتصنيفها.
- **COLLISION_KEY:** Lane-G — cell-authority-audit

### EXEC-CELL-FRONTIER-003 — تثبيت Frontier كمسار downstream-only
- **TASK_ID:** EXEC-CELL-FRONTIER-003
- **TYPE:** VERIFY
- **PRIORITY:** P1
- **OWNER:** Architecture/Control-Plane
- **STATUS:** VERIFYING
- **PR:** #1214
- **SCOPE:** `packages/contracts/src/cell-lifecycle.ts`, lifecycle contract tests
- **DEPENDS_ON:** EXEC-CELL-INDEPENDENCE-003
- **SOURCE:** CELL downstream-state review
- **EVIDENCE:** frontier-before-promotion negative test
- **ACCEPTANCE:** Frontier no ينشأ قبل LEARNED وno يملك mutation على promotion/canonical state، وكل proposal reversible ومقيد بالمقاييس.
- **NEXT_ACTION:** شغّل lifecycle regression + static boundary checks وسجّل exact-SHA evidence.
- **COLLISION_KEY:** Lane-G — cell-frontier

## P1 — Verification / Global Platform

### EXEC-HUB-AUDIT-001 — تدقيق خط أساس FLIXO Hub المحلي الخصوصي
- **TASK_ID:** EXEC-HUB-AUDIT-001
- **TYPE:** AUDIT
- **PRIORITY:** P0
- **OWNER:** Architecture/Execution
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** `docs/**`, `src/**`, `public/**`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `.github/workflows/**`
- **DEPENDS_ON:** none
- **SOURCE:** FLIXO Hub execution brief dated 2026-10-08
- **EVIDENCE:** docs/FLIXO-HUB-STAGE0-BASELINE-2026-10-08.md is baseline context only; fresh evidence must bind to the current exact execution SHA.
- **ACCEPTANCE:** توثيق نقطة اnoنطnoق الحالية وتحديد الفجوات التي تمنع عmay FLIXO Hub: عدم خروج ملفات المستخدم، عدم اnoعتماد على طرف ثالث، الخصوصية المحلية، وحدود runtime واضحة؛ no تُستخدم SHA HISTORICALة كشهادة حالية.
- **NEXT_ACTION:** شغّل اختبار Stage 1 على current exact execution SHA وسجّل النتيجة الجديدة قبل إغnoق البطاقة.
- **COLLISION_KEY:** Lane-C — flixo-hub-baseline




### EXEC-HUB-STAGE1-CORE-001 — تنفيذ Core الخصوصية المحلي للمرحلة 1
- **TASK_ID:** EXEC-HUB-STAGE1-CORE-001
- **TYPE:** IMPLEMENT
- **PRIORITY:** P0
- **OWNER:** Architecture/Execution
- **STATUS:** VERIFYING
- **PR:** #1239
- **SCOPE:** `src/core/**`, `src/pages/hub-*.tsx`, `src/routes/hub.tsx`, `src/routes/en-hub.tsx`, `src/routes/route-tree.ts`, `src/hub.css`, `_headers`, `scripts/generate-static-route-entries.mjs`, `tests/hub-stage1-contract.test.mjs`, `tests/official/hub-stage1-privacy.spec.ts`, `src/worker.ts`, `vercel.json`, `src/lib/telemetry/telemetry-tracker.ts`, `src/tools/image-toolkit/ocr-worker-client.ts`, `package.json`
- **DEPENDS_ON:** EXEC-HUB-AUDIT-001
- **SOURCE:** FLIXO Hub execution brief dated 2026-10-08
- **EVIDENCE:** historical implementation SHA 7324f80ed3113df796020683f6f33ccec50690d5 retained for lineage only; fresh exact-SHA evidence must come from the current CI Hub Stage 1 gate.
- **ACCEPTANCE:** worker pool موحد مع تmayم وإلغاء؛ نقل Transferable؛ OPFS مع fallback؛ feature detection لـ SIMD/OPFS/SharedArrayBuffer/WebGPU؛ صفحات Hub عربية وإنجليزية؛ static route materialization؛ CSP origin-only؛ Referrer-Policy no-referrer؛ عدم وجود CDN/Beacon في the path المحلي؛ واختبار متصفح للشبكة المحلية.
- **NEXT_ACTION:** شغّل npm test:hub وnpm run test:e2e على exact execution SHA وسجّل النتيجة دون استخدام claims HISTORICALة.
- **COLLISION_KEY:** Lane-A1/B/C — flixo-hub-stage1

### EXEC-AUDIT-CONSOLIDATED-001 — تدقيق السلطة وsources الحالية
- **TASK_ID:** EXEC-AUDIT-CONSOLIDATED-001
- **TYPE:** AUDIT
- **PRIORITY:** P1
- **OWNER:** Architecture/Audit
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** `src/lib/execution/**`, `src/config/**`, `docs/**`
- **DEPENDS_ON:** EXEC-PR-RECONCILE-001
- **SOURCE:** recovery/source-authority records
- **EVIDENCE:** architecture/boundary tests + current-SHA audit
- **ACCEPTANCE:** no second registry/executor/verifier/ledger؛ MVP remains bounded to ten capabilities.
- **NEXT_ACTION:** شغّل exact-SHA architecture/security audit وسجّل gaps المتبقية.
- **COLLISION_KEY:** Lane-B — authority-audit

### EXEC-TESTSPRITE-MOCK-001 — تثبيت fallback الخارجي
- **TASK_ID:** EXEC-TESTSPRITE-MOCK-001
- **TYPE:** VERIFY
- **PRIORITY:** P1
- **OWNER:** QA/Release
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** `testsprite/**`, `.github/workflows/testsprite-execution.yml`, fallback tests
- **DEPENDS_ON:** EXEC-VIDEO-FIXTURE-002
- **SOURCE:** TestSprite contract
- **EVIDENCE:** fallback implementation and tests
- **ACCEPTANCE:** missing external configuration cannot become GREEN؛ fallback is explicit and fail-closed.
- **NEXT_ACTION:** شغّل fallback contract suite على current exact SHA.
- **COLLISION_KEY:** External — testsprite-fallback

### EXEC-TESTSPRITE-001 — القبول الخارجي الحقيقي
- **TASK_ID:** EXEC-TESTSPRITE-001
- **TYPE:** VERIFY
- **PRIORITY:** P1
- **OWNER:** QA/Release
- **STATUS:** OWNER_ACTION
- **PR:** n/a
- **SCOPE:** external TestSprite configuration and evidence only
- **DEPENDS_ON:** EXEC-TESTSPRITE-MOCK-001
- **SOURCE:** TestSprite release acceptance
- **EVIDENCE:** none
- **ACCEPTANCE:** real TestSprite execution completes, or release policy explicitly records the gate as blocked؛ mock result never satisfies this gate.
- **NEXT_ACTION:** وفّر credentials/configuration ثم نفّذ test الخارجي وأرفق evidence ID.
- **COLLISION_KEY:** Owner — testsprite

### EXEC-GLOBAL-BASELINE-001 — قياس خط الأساس العالمي
- **TASK_ID:** EXEC-GLOBAL-BASELINE-001
- **TYPE:** VERIFY
- **PRIORITY:** P1
- **OWNER:** Global-Platform / QA
- **STATUS:** QUEUED
- **PR:** none
- **SCOPE:** `scripts/ci/verify-global-baseline.mjs`, `docs/FLIXO-GLOBAL-BASELINE-CONTRACT.md`, four regional probes، privacy/accessibility evidence
- **DEPENDS_ON:** EXEC-PROMOTE-001
- **SOURCE:** G1 Global Baseline
- **EVIDENCE:** none
- **ACCEPTANCE:** exact-SHA manifest covers Europe/North America/Middle East/Asia-Pacific مع p50/p95/error rate، no file upload، no third-party upload route، consent evidence، WCAG 2.2 AA evidence، localization/hreflang evidence.
- **NEXT_ACTION:** اجمع probes للمناطق الأربع على deployed SHA ثم تحقق من manifest بالـverifier.
- **COLLISION_KEY:** Lane-G — global-baseline

### EXEC-GLOBAL-LOCALE-001 — languages العالمية وRTL
- **TASK_ID:** EXEC-GLOBAL-LOCALE-001
- **TYPE:** VERIFY
- **PRIORITY:** P1
- **OWNER:** Global-Platform / i18n
- **STATUS:** QUEUED
- **PR:** none
- **SCOPE:** `src/lib/i18n/**`, localized routes/metadata، localization tests
- **DEPENDS_ON:** EXEC-GLOBAL-BASELINE-001
- **SOURCE:** G2 Global Productization
- **EVIDENCE:** existing locale dictionaries and runtime/hreflang suites؛ fresh exact-SHA run required
- **ACCEPTANCE:** canonical locale coverage passes؛ Arabic RTL passes؛ hreflang/x-default pass؛ localized metadata is real؛ no runtime machine translation dependency.
- **NEXT_ACTION:** شغّل locale verifier والـofficial runtime suite على exact production-derived SHA.
- **COLLISION_KEY:** Lane-C — localization

### EXEC-GLOBAL-CAPABILITY-001 — عmay capability عالمي
- **TASK_ID:** EXEC-GLOBAL-CAPABILITY-001
- **TYPE:** IMPLEMENT
- **PRIORITY:** P1
- **OWNER:** Architecture/Platform
- **STATUS:** QUEUED
- **PR:** none
- **SCOPE:** `src/config/tool-platform/global-capability-contract.ts`, release contract tests
- **DEPENDS_ON:** EXEC-GLOBAL-BASELINE-001
- **SOURCE:** G2 capability admission
- **EVIDENCE:** contract implementation + tests pending current-SHA execution
- **ACCEPTANCE:** descriptor schema covers lifecycle، execution mode، input/output، safety/privacy، localization، regional availability، limits، evidence دون إنشاء runtime authority ثانية.
- **NEXT_ACTION:** شغّل contract tests على current exact SHA دون تغيير MVP registry.
- **COLLISION_KEY:** Lane-B — capability-contract

### EXEC-GLOBAL-EVIDENCE-001 — Evidence Fabric
- **TASK_ID:** EXEC-GLOBAL-EVIDENCE-001
- **TYPE:** IMPLEMENT
- **PRIORITY:** P1
- **OWNER:** Release/Evidence
- **STATUS:** QUEUED
- **PR:** none
- **SCOPE:** `scripts/ci/verify-evidence-chain.mjs`, evidence contract docs/tests
- **DEPENDS_ON:** EXEC-GLOBAL-BASELINE-001
- **SOURCE:** G3 External Evidence Fabric
- **EVIDENCE:** chain contract implementation + tests pending current-SHA execution
- **ACCEPTANCE:** evidence proves source SHA → build → artifact digest → attestation → deployment → environment دون أن تصبح dispatch authority.
- **NEXT_ACTION:** شغّل evidence-chain contract tests على current exact SHA.
- **COLLISION_KEY:** Lane-G — evidence-fabric

### EXEC-GLOBAL-TRUST-001 — برنامج الثقة واnoمتثال الدولي
- **TASK_ID:** EXEC-GLOBAL-TRUST-001
- **TYPE:** GOVERNANCE
- **PRIORITY:** P1
- **OWNER:** Security/Compliance
- **STATUS:** QUEUED
- **PR:** none
- **SCOPE:** compliance controls، regional legal/privacy matrix، audit evidence
- **DEPENDS_ON:** EXEC-GLOBAL-EVIDENCE-001, EXEC-GLOBAL-LOCALE-001
- **SOURCE:** G4 International Trust
- **EVIDENCE:** none
- **ACCEPTANCE:** control program لـISO/IEC 27001:2022 وISO/IEC 27701:2025 وWCAG 2.2 AA وmarket-specific privacy/legal requirements؛ no false certification claims.
- **NEXT_ACTION:** ابنِ control matrix وحدد evidence owners بعد نجاح G3.
- **COLLISION_KEY:** Lane-G — trust-program

## P2 — Operating Surface

### EXEC-SCOUT-BOUNDARY-001 — التحقق من حدود وكnoء اnoستكشاف
- **TASK_ID:** EXEC-SCOUT-BOUNDARY-001
- **TYPE:** VERIFY
- **PRIORITY:** P1
- **OWNER:** Architecture/Governance
- **STATUS:** QUEUED
- **PR:** none
- **SCOPE:** `scripts/verify-scout-boundary.mjs`, scout agent profiles, `.agent-intelligence/inbox/**` write boundary
- **DEPENDS_ON:** none
- **SOURCE:** out-of-band execution commit `90074ad3` introducing scout boundary verifier
- **EVIDENCE:** none
- **ACCEPTANCE:** verifier executes successfully on current exact SHA؛ all three scout profiles expose only bounded read/search/edit tools؛ scout write scope is limited to `.agent-intelligence/inbox/` and discovery snapshots؛ target branch is `execution`؛ no production mutation path is introduced.
- **NEXT_ACTION:** شغّل verifier على current exact SHA وافحص changed-file boundary وغياب أي write target خارج inbox/snapshots ثم سجّل النتيجة.
- **COLLISION_KEY:** Lane-A2 — scout-governance

### EXEC-AGENT-SELF-LEARNING-001 — حلقة التعلم الذاتي
- **TASK_ID:** EXEC-AGENT-SELF-LEARNING-001
- **TYPE:** IMPLEMENT
- **PRIORITY:** P2
- **OWNER:** Agent-Learning/Control-Plane
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** `scripts/agent-learning/**`, `scripts/agent-control-plane.mjs`, `scripts/verify-agent-profiles.mjs`, `tests/security/ci/agent-control-plane.test.mjs`, `.github/agents/**`, `agents.md`, `agents/تدريب agents/README.md`, `package.json`, isolated workflow/reporting
- **DEPENDS_ON:** none
- **SOURCE:** self-learning architecture
- **EVIDENCE:** control-plane implementation + deterministic contract/drill tests؛ exact current-SHA execution result pending final validation; real agent behavioral evidence remains unproven.
- **ACCEPTANCE:** learning/control-plane can validate agent identity, capabilities, write boundaries, lifecycle, derived execution envelopes, exact-SHA evidence requirements, and supporting-role isolation without granting execution, merge, deploy, governance, or certification authority.
- **NEXT_ACTION:** شغّل `npm run verify:agent-control-plane` ثم `npm run test:agent-control-plane` ودوّن exact current-SHA outcome.
- **COLLISION_KEY:** Lane-A2 — agent-learning

### EXEC-TOOLS-BOOK-001 — توحيد كتاب الأدوات
- **TASK_ID:** EXEC-TOOLS-BOOK-001
- **TYPE:** INTEGRATE
- **PRIORITY:** P2
- **OWNER:** Product/Documentation
- **STATUS:** QUEUED
- **PR:** none
- **SCOPE:** `الأدوات.md`, tool documentation
- **DEPENDS_ON:** EXEC-GLOBAL-CAPABILITY-001
- **SOURCE:** operating documentation
- **EVIDENCE:** none
- **ACCEPTANCE:** documentation aligns with canonical runtime and global capability terminology؛ cannot define dispatch or runtime authority.
- **NEXT_ACTION:** reconcile the book against current registry and global capability contract.
- **COLLISION_KEY:** Lane-C — tools-book

### EXEC-CELL-CTRL-002 — Hard-Control / Execution Firewall Closure

- **TASK_ID:** EXEC-CELL-CTRL-002
- **TYPE:** VERIFY
- **PRIORITY:** P1
- **OWNER:** Architecture/Security
- **STATUS:** VERIFYING
- **PR:** #1214
- **SCOPE:** `packages/contracts/src/cell-hard-control.ts`, `packages/contracts/src/cell-runtime.ts`, `tests/security/ci/cell-hard-control.test.ts`, `tests/security/ci/cell-runtime-contract.test.ts`, `docs/CELL-HARD-CONTROL-CONTRACT.md`, `AGENTS.md`, `الخلية.md`, `المهام.md` hard-control sections, and required CI attribution controls.
- **DEPENDS_ON:** none
- **SOURCE:** EXEC-CELL-ARCH-001 decomposition
- **EVIDENCE:** Hard-Control contract/tests + exact-SHA CI evidence. Historical evidence from pre-split parent is contextual only and must not be reused as current certification evidence after SHA drift.
- **ACCEPTANCE:** no out-of-scope mutation can pass authorization; wrong Task/Agent/Session/Mission/Branch/Start SHA/Objective/Acceptance is denied; live SHA drift invalidates action/evidence; budget/delegation overflow is denied; drift is classified; denied actions do not execute.
- **NEXT_ACTION:** rerun the applicable hard-control gates on the current exact execution SHA.
- **COLLISION_KEY:** Lane-C1 — hard-control

### EXEC-CELL-ASSIGN-002 — Assignment / Delegation / Progress Closure

- **TASK_ID:** EXEC-CELL-ASSIGN-002
- **TYPE:** VERIFY
- **PRIORITY:** P1
- **OWNER:** Architecture/Orchestration
- **STATUS:** VERIFYING
- **PR:** #1214
- **SCOPE:** `packages/contracts/src/cell-assignment.ts`, assignment exports/runtime integration in `packages/contracts/src/cell-runtime.ts`, `tests/security/ci/cell-assignment-contract.test.ts`, `docs/CELL-ASSIGNMENT-DELEGATION-CONTRACT.md`, `الخلية.md` assignment sections, and routing-related CI tests.
- **DEPENDS_ON:** none
- **SOURCE:** EXEC-CELL-ARCH-001 decomposition
- **EVIDENCE:** Assignment contract/tests/runtime integration + exact-SHA CI evidence. Historical evidence from pre-split parent is contextual only and must not be reused as current certification evidence after SHA drift.
- **ACCEPTANCE:** routing is capability/artifact/risk/reliability/cost aware; high-risk tasks can require independent verifier/opponent; delegation depth/cost/time/active-subtask limits are enforced; typed handoffs carry exact task/session/assignment/SHA context; progress stall triggers reassignment/replan; no second dispatch authority exists.
- **NEXT_ACTION:** rerun the applicable assignment/delegation gates on the current exact execution SHA.
- **COLLISION_KEY:** Lane-C2 — assignment-delegation

## CELL PARENT REFERENCES (NON-DISPATCHABLE)

`EXEC-CELL-ARCH-001` is retained as parent lineage only. Its child tracks are the executable units; the parent creates no dispatch authority.


### EXEC-CELL-LIVENESS-001 — تشغيل واستعادة liveness تلقائيًا
- **TASK_ID:** EXEC-CELL-LIVENESS-001
- **TYPE:** VERIFY
- **PRIORITY:** P1
- **OWNER:** Architecture/Control-Plane
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** `packages/contracts/src/cell-runtime.ts`, `packages/contracts/src/cell-liveness.ts`, liveness runtime tests and required CI attribution controls
- **DEPENDS_ON:** none
- **SOURCE:** execution commits `b56a8c7e774625df207826a2dffe3bcc3a4583cb` and `2b83a6771f874852a65560bbeb04bcc6ed66f0dc`
- **EVIDENCE:** implementation commits establish automatic liveness start, safe default wake identity, and unref'd heartbeat timer; exact current-SHA verification pending
- **ACCEPTANCE:** CellRuntime starts liveness by default with a bounded wake callback; heartbeat timers are unref'd when supported; explicit opt-out remains available; exact-SHA liveness/typecheck/red-team evidence passes without authority or lifecycle regressions.
- **NEXT_ACTION:** run the exact-SHA CELL liveness and runtime assurance suites on current execution head and record evidence.
- **COLLISION_KEY:** Lane-C3 — cell-liveness



## DEVELOPER PLATFORM — P0/P1 FOUNDATION CLOSURE

### EXEC-PLATFORM-CONTRACT-001 — عmay منصة programming العامة
- **TASK_ID:** EXEC-PLATFORM-CONTRACT-001
- **TYPE:** IMPLEMENT
- **PRIORITY:** P0
- **OWNER:** Architecture/Platform
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** `src/lib/developer-platform/**`, platform contract tests, platform documentation
- **DEPENDS_ON:** none
- **SOURCE:** user mandate dated 2026-10-08 + current developer capability registry + existing CELL/Exact-SHA boundaries
- **EVIDENCE:** implementation is present on the current execution tree; fresh exact-SHA CI evidence is required before closure.
- **ACCEPTANCE:** عmay موحد يعرّف Project/Workspace/Execution/Verification/Repository/Contribution/Artifact boundaries؛ no ينشئ runtime authority ثانية؛ كل mutating execution يبقى خلف capability/scope/SHA gates؛ provider-neutral interfaces تمنع fake execution.
- **NEXT_ACTION:** شغّل targeted platform contract/hard-control suites on the current exact execution SHA.
- **COLLISION_KEY:** Lane-A2 — programming-platform-contract

### EXEC-PLATFORM-WORKSPACE-001 — مساحة تطوير موحدة
- **TASK_ID:** EXEC-PLATFORM-WORKSPACE-001
- **TYPE:** IMPLEMENT
- **PRIORITY:** P0
- **OWNER:** Product/Developer Experience
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** `src/pages/developer-platform.tsx`, `src/routes/developer-platform.tsx`, platform styles, route tests
- **DEPENDS_ON:** EXEC-PLATFORM-CONTRACT-001
- **SOURCE:** general programming platform UX mandate
- **EVIDENCE:** implementation is present on the current execution tree; fresh exact-SHA CI evidence is required before closure.
- **ACCEPTANCE:** شاشة موحدة تعرض project tree/workspace state/capability status/execution state/verification/evidence؛ no تعرض نجاحًا زائفًا وno تشغل code خارج executor contract؛ الوصول قابل للترجمة وRTL/LTR.
- **NEXT_ACTION:** اربط surface state بworkspace runtime ثم سجّل exact-SHA route/browser evidence.
- **COLLISION_KEY:** Lane-B/C — programming-platform-workspace

### EXEC-PLATFORM-EXECUTOR-001 — حدود execution الآمن للبرامج
- **TASK_ID:** EXEC-PLATFORM-EXECUTOR-001
- **TYPE:** IMPLEMENT
- **PRIORITY:** P0
- **OWNER:** Security/Runtime
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** execution-provider contracts, sandbox policy, job/artifact evidence contracts, security tests
- **DEPENDS_ON:** EXEC-PLATFORM-CONTRACT-001
- **SOURCE:** general programming platform security architecture
- **EVIDENCE:** implementation is present on the current execution tree; fresh exact-SHA CI evidence is required before closure.
- **ACCEPTANCE:** execution العام يدعم providers مع ephemeral filesystem، CPU/memory/time limits، network policy، secret isolation، cancellation، artifact digest، exact source SHA؛ غياب provider حقيقي يبقى BLOCKED وno يتحول إلى GREEN/mock.
- **NEXT_ACTION:** نفّذ provider proof على runtime حقيقي أو أبقِ provider BLOCKED دون mock green.
- **COLLISION_KEY:** Lane-A2/G — programming-platform-executor

### EXEC-PLATFORM-GIT-001 — طبقة مستودعات Git
- **TASK_ID:** EXEC-PLATFORM-GIT-001
- **TYPE:** IMPLEMENT
- **PRIORITY:** P1
- **OWNER:** Integration/Developer Experience
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** repository provider contracts, GitHub integration boundary, branch/commit/PR evidence adapters
- **DEPENDS_ON:** EXEC-PLATFORM-CONTRACT-001
- **SOURCE:** public programming platform collaboration requirement
- **EVIDENCE:** implementation is present on the current execution tree; fresh exact-SHA CI evidence is required before closure.
- **ACCEPTANCE:** repository provider interface يدعم GitHub أولًا؛ كل mutation يحمل project/task/SHA identity؛ no direct-main وno token persistence في browser؛ repository state يُعامل كexternal evidence no كبديل للـcanonical ledger.
- **NEXT_ACTION:** شغّل governed Git provider tests ثم اربط transport الخارجي دون تخزين credentials في المتصفح.
- **COLLISION_KEY:** Lane-G — programming-platform-git

### EXEC-PLATFORM-CONTRIBUTION-001 — اقتصاد المساهمة والتعلم
- **TASK_ID:** EXEC-PLATFORM-CONTRIBUTION-001
- **TYPE:** IMPLEMENT
- **PRIORITY:** P1
- **OWNER:** Platform/Governance
- **STATUS:** VERIFYING
- **PR:** none
- **SCOPE:** contribution/evidence contracts, skill/tool proposal flow, reputation signals, marketplace policy docs/tests
- **DEPENDS_ON:** EXEC-PLATFORM-CONTRACT-001, EXEC-PLATFORM-EXECUTOR-001, EXEC-PLATFORM-GIT-001
- **SOURCE:** user mandate that the platform should benefit users and itself through governed contributions
- **EVIDENCE:** implementation is present on the current execution tree; fresh exact-SHA CI evidence is required before closure.
- **ACCEPTANCE:** contribution flow يربط proposal→review→verification→publication؛ no يمنح reputation أو revenue credits بno evidence؛ tool/agent/skill proposals تدخل canonical admission path؛ telemetry no تكشف user code or secrets.
- **NEXT_ACTION:** شغّل evidence-bound contribution admission/publishing tests دون إنشاء market authority ثانية.
- **COLLISION_KEY:** Lane-G — programming-platform-contribution


### EXEC-LEAD-MEMORY-001 — اعتماد وثيقة عمل agent القائد ونظام الذاكرة
- **TASK_ID:** EXEC-LEAD-MEMORY-001
- **TYPE:** GOVERNANCE
- **PRIORITY:** P1
- **OWNER:** GPT-Lead-Agent / FLIXO-Hub
- **STATUS:** VERIFYING
- **PR:** #1252
- **SCOPE:** `docs/FLIXO-LEAD-AGENT-WORKING-CONTRACT-v1.1.md`, `AGENTS.md`
- **DEPENDS_ON:** none
- **SOURCE:** owner mandate dated 2026-10-08; Lead Agent working contract v1.1
- **EVIDENCE:** implementation merged to execution at exact SHA `5140cedd7bced490ea428e494527eba29b373352`; document blob `b30235fa96adefd84018d80fbf5b998eefc1a916`; PR #1252
- **ACCEPTANCE:** وثيقة v1.1 منشورة كمصدر العمل الCANONICAL للوكيل القائد، ويشير `AGENTS.md` إليها بوصفها الذاكرة الصريحة/عmay العمل الCANONICAL دون إنشاء سلطة تنفيذية ثانية أو إضعاف hard-control
- **NEXT_ACTION:** نفّذ مراجعة مستقلة للمحتوى والسياسات وحدود الذاكرة على exact execution SHA وسجّل النتيجة في evidence.
- **COLLISION_KEY:** Lane-C — lead-memory


### SCOUT-INTELLIGENCE-BOUNDARY — Research Scouts
الحالة: EXECUTED — BOUNDARY HARDENED
execution:
- ثnoثة GitHub custom agents متخصصة: Architecture / Technology / Ecosystem.
- أدوات كل Scout محصورة في read + search + edit.
- هدف الكتابة الوحيد: `agents/reports/<agent>/` وفق contract canonical؛ `development.md` DATA ONLY وno تُكتب من Scouts.
- فصل الأقسام: Architecture Radar / Technology Radar / Ecosystem Radar.
- Scout statuses محصورة في DISCOVERED / VERIFIED / WATCH / REJECTED.
- فرع Scout مسموح فقط بصيغة scout/* ويستهدف execution وno يغير إno development.md.
- CI boundary verifier يفشل مغلقاً عند تغيير أي ملف آخر أو استهداف main.
- `development.md` معرف صراحة كـ DATA ONLY وغير موثوق؛ no يمنح Dispatch أو Mutation أو Certification authority.
- GitHub Copilot Automations غير متاحة حالياً لأن المستودع public؛ تفعيل الجدولة requires أهلية GitHub المناسبة.
proof:
- profiles: .github/agents/flixo-scout-architecture.agent.md
- .github/agents/flixo-scout-technology.agent.md
- .github/agents/flixo-scout-ecosystem.agent.md
- boundary verifier: scripts/verify-scout-boundary.mjs
- regression test: tests/security/ci/scout-boundary.test.mjs
- workflow: .github/workflows/scout-boundary.yml


---

# END ACTIVE DISPATCH QUEUE


## 4. خطط أخرى وفجوات لم تُغلق بعد

هذه القائمة تمنع سقوط الالتزامات الموجودة خارج قائمة المهام. لا تُوزّع البنود الموسومة «مكتشف / غير قابل للتوزيع» مباشرة؛ أولاً طابقها مع TASK_ID موجود، أو أضف بطاقة كاملة إلى FLIXO-Tasks.md عبر البروتوكول القانوني. لا تنشئ مهمة مكررة لنطاق موجود بالفعل.

### 4.1 تسوية حالة السجلات والـSHA

- **الحالة:** مطلوب reconciliation، وليست شهادة فشل تنفيذ.
- **المصدر:** docs/FLIXO-EXECUTION-LEDGER.md وSTATE.md وFLIXO-Tasks.md.
- **الدليل:** سجل التنفيذ يحتوي SHA مرشحاً تاريخياً d7d0c2e6b7a07a044c3772f8382c3b5a1e4ac440، وSTATE.md يسجل SHA أقدم 64587c0a20075a352ff2617785f6739009f413ee، بينما HEAD الحي وقت هذا التجميع هو 59b85cce939289f2eb88037f8721688a95abce0a.
- **الإجراء:** حدّث الحالة من HEAD الحي وPRs والأدلة الفعلية، وصنّف كل سجل إلى CURRENT أو HISTORICAL أو SUPERSEDED. لا تعِد استخدام نتائج CI المرتبطة بـSHA آخر.
- **الربط:** راجع بطاقات EXEC-PR-RECONCILE-001 وEXEC-CERT-FINAL-001 وأي بطاقات Prompt موجودة. لا تضف نسخة ثانية إذا كانت التغطية نفسها.

### 4.2 إغلاق Prompt 02 — نطاق MVP

- **الحالة المسجلة:** IN_PROGRESS، وEND_SHA=PENDING في docs/FLIXO-PROMPT-02-STATE.md.
- **القبول:** تحقق على SHA واحد من تطابق القدرات العشر مع registry/executor/output contracts/verifiers، ثم typecheck وlint وcore tests وbuild وأدلة browser/security المطلوبة.
- **الإجراء التالي:** اربط هذا الالتزام ببطاقة موجودة في القائمة أعلاه أو أضف بطاقة قانونية واحدة؛ أعد تشغيل البوابات على HEAD الحي فقط. لا تغلقه بناءً على تنفيذ تاريخي أو وثيقة وحدها.

### 4.3 إغلاق Prompt 10 — الأمن

- **الحالة المسجلة:** IN PROGRESS في docs/FLIXO-PROMPT-10-STATE.md؛ التحقق النهائي على SHA الحالي معلّق وفق الوثيقة.
- **القبول:** نجاح اختبارات الأمن وCI وCodeQL وSecret Scan وRed Team على SHA الحالي، وتسجيل الأدلة.
- **الإجراء التالي:** اربطه ببطاقة أمن/حوكمة قائمة أو أنشئ بطاقة قانونية واحدة بعد فحص التداخل. أي تغيير جديد يبطل الدليل المرتبط بالـSHA السابق.

### 4.4 عائق G0 — الحوكمة والترقية

- **الحالة المسجلة في سجل التنفيذ:** قواعد main غير مكتملة، وقواعد execution لم يُثبت اكتمالها، وأدلة الترقية النهائية متوقفة على الحوكمة.
- **البطاقات الموجودة ذات الصلة:** EXEC-GOV-AUTOMATED-001، EXEC-GOV-LIVE-001، EXEC-CERT-FINAL-001، EXEC-PROMOTE-001، EXEC-TESTSPRITE-001.
- **البروتوكول:** لا تنفذ ترقية إلى main ولا تدّعِ certification حتى تتوفر الموافقات/القواعد المطلوبة ودليل promotion exact-SHA. إذا كانت صلاحيات الإدارة غير متاحة، سجّل blocker مع دليل ولا تتحايل عليه.

### 4.5 CELL — فجوات TARGET المطلوب مطابقتها مع التنفيذ

يوضح docs/CELL-CANONICAL-ARCHITECTURE.md أن المراحل التالية TARGET وليست كلها مثبتة كـCURRENT. افحص كل مرحلة مقابل الكود والاختبارات وبطاقات CELL الموجودة، ثم اربطها بالبطاقة المناسبة دون تكرار:

- TASK ADMISSION: fail-closed عند غياب mission/criteria/evidence/risk class، أو Solver/Opponent أساسيين، أو backups/opp­osition plan/policies المطلوبة.
- ASSIGNMENT وPAIR LOCK: تثبيت هوية المهمة والوكيل والجلسة والـSHA وحدود التفويض قبل التنفيذ.
- OPPONENT INDEPENDENT START وSOLVE ⇄ FALSIFY: تسجيل موقف الخصم المستقل قبل كشف نتيجة Solver، ومشاركة الحد الأدنى المسموح من السياق فقط.
- RECONCILIATION وARBITRATION: حفظ claim/counterclaim/evidence/disposition؛ Solver لا يحكم نزاعه بنفسه.
- CANDIDATE وRED TEAM وINDEPENDENT VERIFICATION: تسليم مرشح SHA محدد إلى Red Team منفصل ثم تحقق مستقل قبل الشهادة.
- CERTIFICATION وPROMOTION: ربطهما ببوابات الحوكمة القائمة؛ لا سلطة شهادة أو ترقية جديدة داخل CELL.
- LEARNING وFRONTIER: تعلّم مبني على نتائج موثقة، وFrontier لاحق لـLEARNED ولا يغيّر الحالة القانونية أو الترقية.

**الإجراء التالي:** ابدأ بالبطاقات الموجودة EXEC-CELL-RECOVERY-003 وEXEC-CELL-REPLAY-003 وEXEC-CELL-INDEPENDENCE-003 وEXEC-CELL-AUTHORITY-AUDIT-003 وEXEC-CELL-FRONTIER-003 وEXEC-CELL-CTRL-002 وEXEC-CELL-ASSIGN-002 وEXEC-CELL-LIVENESS-001. بعد فحصها، أضف فقط فجوة CELL المتبقية فعلاً إلى FLIXO-Tasks.md كبطاقة كاملة؛ لا تعتبر وجود العقد أو الاختبارات وحده دليلاً على أن التدفق كله CURRENT.

### 4.6 التكاملات والخطط الخارجية

- .testsprite/plans/manual-homepage.json و.testsprite/plans/manual-background-remover.json خطتا اختبار يدويتان؛ وجود JSON لا يثبت تنفيذ الاختبار الخارجي.
- اربطهما ببطاقتي EXEC-TESTSPRITE-001 وEXEC-TESTSPRITE-MOCK-001. النتيجة الوهمية أو غياب الاعتماد الخارجي لا يساوي PASS.
- docs/FLIXO-GLOBAL-ROADMAP.md هي مصدر اشتقاق G0 → G4 وليست تصريحاً بتجاوز الترتيب. البطاقات الحالية EXEC-GLOBAL-BASELINE-001 وEXEC-GLOBAL-LOCALE-001 وEXEC-GLOBAL-CAPABILITY-001 وEXEC-GLOBAL-EVIDENCE-001 وEXEC-GLOBAL-TRUST-001 تغطي أجزاء من G1–G4؛ تحقق من شروط كل مرحلة قبل الانتقال إلى التالية.
- FLIXO-Engineering-Ledger.md موسوم DATA ONLY / AUTHORITY NONE / EXECUTION FORBIDDEN. لا تستخرج منه أوامر تنفيذ مباشرة.
- docs/FLIXO-PROMPT-01-STATE.md مصنف HISTORICAL؛ لا تعِد فتحه إلا إذا كشف فحص حي عن فجوة حالية. تقارير الإغلاق القديمة وdocs/archive/CELL-PRESERVED-2026-10-07.md مصادر تاريخية وليست مهاماً نشطة بذاتها.

### 4.7 خلل في بطاقة قائمة المهام

ظهر عنوان SCOUT-INTELLIGENCE-BOUNDARY في نهاية قائمة المهام النشطة دون TASK_ID وSTATUS وNEXT_ACTION وACCEPTANCE ظاهرة في البطاقة المنقولة. لا توزّعها بهذه الصورة. طابقها مع تعريف Scouts في AGENTS.md وملفات الوكلاء؛ ثم أكمل البطاقة القانونية أو أزلها من القائمة النشطة بعد إثبات أنها ليست التزاماً مستقلاً.

## 5. سجل الإغلاق المختصر

اترك هذا السجل فارغاً عند إنشاء الملف. قبل إزالة أي بطاقة مكتملة من قائمة التنفيذ، أضف سطراً واحداً بالشكل التالي:

| TASK_ID | FINAL_SHA | EVIDENCE_REF | CLOSED_DATE |
|---|---|---|---|
| — | — | — | — |

لا تسجل مهمة هنا على أنها مغلقة قبل قبول معاييرها فعلياً. سجل الإغلاق يحتفظ بأثر الإثبات فقط، ولا يعيد المهمة إلى قائمة العمل.

## 6. قاعدة التشغيل المختصرة

**افحص المصدر → طابق/أزل التكرار → ثبّت SHA → نفّذ عبر الضوابط المعتمدة → اختبر → تحقق مستقلاً عند اللزوم → سجّل الدليل → احذف البطاقة النشطة → احتفظ بسطر إغلاق → أعد العدّ.**

لا تحذف ملف الخطة الأصلي. لا تُغلق مهمة لأن «الكود موجود». لا تُعدّ حالة غير متحققة GREEN، ولا تستخدم دليلاً من SHA قديم، ولا تنشئ سلطة تنفيذ أو registry أو executor أو certification ثانية.
