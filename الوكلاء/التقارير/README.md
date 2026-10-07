# تقارير الوكلاء

هذا هو **مركز التقارير الرسمي والوحيد** لوكلاء FLIXO.

كل وكيل يملك مجلدًا مستقلًا هنا، وجميع التقارير التشغيلية والتطويرية والتحققية والسلوكية الخاصة به يجب أن تُحفظ في مجلده فقط.

لا تُستخدم `.agent-intelligence/inbox/` لتقارير الوكلاء؛ فهي مخصصة لمخرجات البحث الخام المسموح بها للمستكشفين.

## القواعد

1. الهوية والـAgent ID مصدرهما `الوكلاء.md`.
2. مجلد التقرير لكل وكيل محدد في `activity/report registry` داخل `الوكلاء.md`.
3. التقرير يجب أن يحمل Exact-SHA.
4. لا يجوز إنشاء مركز تقارير بديل داخل حزم الوكلاء.
5. التصحيح يتم بتقرير/حدث جديد ولا تُمحى الأدلة التاريخية.
6. أي تقرير خارج المسار canonical يُعد **REPORT-ROUTING-VIOLATION**.
7. سجلات نشاط الوكلاء تبقى داخل حزمهم؛ هذه المساحة مخصصة للتقارير والنتائج القابلة للتتبع.

## الوكلاء المسجلون

- AGENT-01 — المستكشف AI
- AGENT-02 — المطور AI
- AGENT-03 — FLIXO i18n Agent
- AGENT-04 — FLIXO Repository Maintainer Agent
- AGENT-05 — FLIXO QA Agent
- AGENT-06 — Red Team 1
- AGENT-07 — Red Team 2
- AGENT-08 — FLIXO Architecture Scout
- AGENT-09 — FLIXO Technology Scout
- AGENT-10 — FLIXO Ecosystem Scout
- SUPPORT-EXPLORER-02 — المستكشف 2

**Canonical source:** `الوكلاء.md`
