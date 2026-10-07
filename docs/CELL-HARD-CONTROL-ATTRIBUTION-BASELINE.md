# CELL — COMMIT ATTRIBUTION BASELINE

Status: ACTIVE ENFORCEMENT BASELINE
BASELINE_SHA: 6159b5be734055b7aad8d893cf3c900534911100

من هذه النقطة، كل commit جديد خاص بخط CELL يجب أن يحمل TASK_ID صالحًا ظاهرًا داخل ACTIVE DISPATCH QUEUE في المهام.md.

Bootstrap reconciliation:
- commits التي سبقت نقطة التفعيل تُحفظ كتاريخ ولا يعاد كتابة Git history.
- أي تغييرات CELL متوازية دخلت قبل نقطة التفعيل لا تُعامل كدليل تنفيذ مستقل؛ تبقى ضمن baseline التاريخي.
- enforcement يبدأ فقط من BASELINE_SHA وما بعده، ويُفحص بواسطة CI على full git history.

CI enforcement: scripts/ci/cell-commit-attribution.mjs.

Fail-closed rule: missing or non-active TASK_ID in a post-baseline CELL commit = gate failure.
