# FLIXO — بروتوكول سجل نشاط الوكلاء

**Protocol ID:** `flixo-agent-activity-v1`  
**Status:** MANDATORY / FAIL-CLOSED  
**Canonical identity:** `الوكلاء.md`

## 1. الغرض

هذا البروتوكول يجعل كل نشاط تشغيلي للوكيل قابلاً للتتبع والتقييم على Exact-SHA واحد. لكل وكيل سجل نشاط مستقل محدد في `الوكلاء.md`.

السجل لا يحل محل `المهام.md` ولا يمنح أي سلطة إضافية. مهمة `المهام.md` هي مصدر التكليف. تقارير النتائج والاقتراحات والتوصيات لها مسار مستقل إلزامي داخل `الوكلاء/التقارير/`، بينما سجل النشاط هو دفتر الأثر التنفيذي.

## 2. ما الذي يجب تسجيله

يجب إنشاء حدث سجل قبل وبعد كل عملية تشغيلية، بما في ذلك:

- بدء مهمة أو إعادة أخذها بعد انقطاع.
- قراءة/بحث/تحليل أدى إلى استنتاج تشغيلي مؤثر.
- قرار أو تغيير في الخطة أو ترتيب الأولويات.
- أي تعديل، ولو كان سطرًا واحدًا أو تغييرًا توثيقيًا بسيطًا.
- أي أمر أو اختبار أو فحص اعتمد عليه قرار.
- فشل، استثناء، blocker، تراجع، إعادة تخطيط أو اكتشاف تعارض.
- التسليم إلى وكيل آخر أو إلى بوابة تحقق.
- إنهاء المهمة أو إعلان النتيجة.

### التفكير التشغيلي

المطلوب تسجيل **ملخص قابل للتدقيق** لا السلسلة الداخلية الخاصة للتفكير. يجب تسجيل المشكلة/السؤال، الفرضيات أو البدائل المهمة، القرار، سبب القرار، ومستوى عدم اليقين. لا يُطلب ولا يُسجّل chain-of-thought الخاص أو أي أسرار أو مفاتيح.

## 3. الحد الأدنى لكل حدث

كل حدث يجب أن يحتوي:

`Timestamp UTC`  
`Agent ID`  
`Agent Name`  
`Task ID` أو `UNBOUND`  
`Event Type`  
`Exact SHA Before`  
`Intent / Decision Summary`  
`Scope`  
`Action / Command`  
`Files / Artifacts`  
`Outcome`  
`Evidence / Reference`  
`Exact SHA After` عند وجود تغيير  
`RCA / Blocker` إن وجد  
`Next Action`

## 4. دورة الحدث الإلزامية

قبل العمل على مهمة ذات صلة معرفيًا يجب على الوكيل تنفيذ **Shared-Memory Preflight**:
1. البحث في الذاكرة المشتركة بالسؤال/المهمة على Exact-SHA الحالي.
2. التمييز بين `usable=true` و`STALE_EVIDENCE` و`CANDIDATE` وعدم خلطها.
3. تسجيل معرفات المعرفة التي استُخدمت أو سبب عدم وجود نتيجة مناسبة.

بعد العمل يجب تسجيل أي درس أو anti-lesson أو heuristic أو warning أو fact جديد كـLearning Proposal بعد وضع النتيجة في تقرير الوكيل المركزي.

`START → MEMORY-PREFLIGHT → OBSERVE/THINK → ACT → VERIFY → LEARN-PROPOSE → HANDOFF/END`

لا يجوز تسجيل `END` أو `PASS` بدون ربط النتيجة بالأدلة الحالية.

عند حدوث drift في SHA أثناء المهمة:  
`FREEZE → RECORD DRIFT → REBASE/REPLAN → CONTINUE`

ولا تُنقل أدلة SHA القديم كأنها دليل للـSHA الجديد.

## 5. قاعدة الفشل المغلق

إذا تعذر إنشاء سجل `START` أو تعذر تحديث السجل بعد نشاط فعلي، تكون حالة التتبع `TRACE-BLOCKED`. لا يجوز للوكيل الادعاء بأن المهمة مكتملة أو VERIFIED اعتمادًا على تنفيذ غير قابل للتتبع.

فشل الكتابة إلى سجل النشاط نفسه حدث يجب تسجيله في أقرب قناة أدلة مسموحة وفق عقد الوكيل، ولا يجوز استخدام `.agent-intelligence/inbox/` كبديل للتقرير أو السجل.

## 6. السجل Append-Only

السجل تاريخي. لا تُعاد كتابة الأحداث السابقة لإخفاء خطأ أو تعديل نتيجة. أي تصحيح يسجل كحدث جديد من النوع `CORRECTION` مع مرجع الحدث المصحح.

لا يجوز حذف سجل تاريخي أو استبداله لإزالة دليل سلبي.

## 7. تقييم الوكيل

يُستخدم السجل لقياس:

- Trace Completeness
- Exact-SHA Discipline
- Evidence Quality
- Decision Quality
- Negative/Counterexample Coverage
- Regression Rate
- Rework / Replan Rate
- Policy Compliance
- Stale/Faulty Claim Rate
- Handoff Quality

وجود ملف السجل وحده لا يعني جودة الوكيل؛ التقييم يعتمد على الأحداث والأدلة والنتائج.

## 8. حالات السجل

`TRACE-READY` → سجل موجود وصالح للاستخدام.  
`TRACE-BLOCKED` → تعذر التسجيل أو يوجد نقص يمنع الاعتماد.  
`TRACE-INCOMPLETE` → المهمة لها أحداث ناقصة.  
`TRACE-COMPLETE` → START/ACT/VERIFY/END مكتملة مع Exact-SHA وأدلة.

## 9. قالب حدث

```md
### EVENT <UTC-TIMESTAMP> — <EVENT-TYPE>
- Agent ID: AGENT-XX
- Agent Name: <Arabic AI name>
- Task ID: <TASK-ID | UNBOUND>
- Exact SHA Before: <40-char SHA>
- Intent / Decision Summary: <brief auditable summary>
- Scope: <paths/systems>
- Action / Command: <what was done or evaluated>
- Files / Artifacts: <paths>
- Outcome: <RESULT>
- Evidence / Reference: <tests/runs/refs>
- Exact SHA After: <40-char SHA | UNCHANGED>
- RCA / Blocker: <none | details>
- Next Action: <next step>
```

## 10. مصدر الحسم

الفحص الآلي يقرأ `الوكلاء.md`، ملفات `.github/agents/`، وسجلات النشاط المحددة لكل وكيل. أي غياب أو انحراف في سجل الوكيل أو بروتوكوله يجب أن يفشل مغلقًا.

**قاعدة أساسية:** لا نشاط غير مسجل، ولا نتيجة قابلة للاعتماد بلا أثر يمكن تدقيقه.


## 11. فصل السجل عن التقرير

**سجل النشاط** = أثر زمني للوكيل داخل حزمة الوكيل.

**التقرير** = نتيجة المهمة/التحليل/الاقتراح/التوصية/التحقق، ويجب أن يوجد فقط داخل:
`الوكلاء/التقارير/<AGENT-ID> — <اسم الوكيل>/`

**منع صريح:** `.agent-intelligence/inbox/` ليس مخزن تقارير أو اقتراحات أو نتائج، ولا يجوز لأي Agent توجيه مخرجاته النهائية إليه.
