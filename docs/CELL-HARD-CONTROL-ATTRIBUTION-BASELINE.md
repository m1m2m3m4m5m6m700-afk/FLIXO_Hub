# CELL — COMMIT ATTRIBUTION BASELINE

Status: ACTIVE ENFORCEMENT BASELINE
BASELINE_SHA: fd7fc796021dbbc14aac31d2a241c348f222a68c

من هذه النقطة، كل commit جديد خاص بخط CELL يجب أن يحمل TASK_ID صالحًا ظاهرًا في `المهام.md`.

لا يتم إعادة كتابة التاريخ السابق ولا force-push. commits السابقة للـbaseline تعامل كـhistorical/pre-hard-control lineage.

CI enforcement: `scripts/ci/cell-commit-attribution.mjs`.
