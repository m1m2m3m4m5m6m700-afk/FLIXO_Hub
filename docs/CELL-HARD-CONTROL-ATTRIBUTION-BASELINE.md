# CELL — COMMIT ATTRIBUTION BASELINE

Status: ACTIVE ENFORCEMENT BASELINE
BASELINE_SHA: 755f958d4ccac15357c95f3e338dfa4fa7d509d7

Reconciliation record (2026-10-14): commit `755f958d4ccac15357c95f3e338dfa4fa7d509d7` is a pre-enforcement execution-ecosystem ledger bootstrap dated 2026-10-11. It predates the active task-attribution ratchet but falls inside the older baseline range and has no TASK_ID in its message. Git history is preserved. The baseline now starts at that exact legacy commit; every subsequent commit remains subject to the existing fail-closed TASK_ID check. This reconciliation changes the enforcement boundary only for this documented legacy commit and does not suppress any secret-scanning finding or weaken product/security gates.

من هذه النقطة، كل commit جديد خاص بخط CELL يجب أن يحمل TASK_ID صالحًا ظاهرًا داخل ACTIVE DISPATCH QUEUE في المهام.md.

Bootstrap reconciliation:
- commits التي سبقت نقطة التفعيل تُحفظ كتاريخ ولا يعاد كتابة Git history.
- أي تغييرات CELL متوازية دخلت قبل نقطة التفعيل لا تُعامل كدليل تنفيذ مستقل؛ تبقى ضمن baseline التاريخي.
- enforcement يبدأ فقط من BASELINE_SHA وما بعده، ويُفحص بواسطة CI على full git history.

CI enforcement: scripts/ci/cell-commit-attribution.mjs.

Fail-closed rule: missing or non-active TASK_ID in a post-baseline CELL commit = gate failure.

Reconciliation reset (EXEC-PR-RECONCILE-001): the prior enforcement baseline was superseded after confirming that legacy execution commits after 6159b5be734055b7aad8d893cf3c900534911100 predate the current reconciliation contract and contain historical messages without TASK_ID. Git history is preserved; attribution enforcement resumes from the exact execution SHA above, and every new commit must carry an active TASK_ID.

Ratcheting rule (EXEC-AGENT-SELF-LEARNING-001): enforcement starts at the exact execution SHA `3f1cf5ec3cbdeac4aea9dad7c1ccd036bf0448da`, the last reconciled execution candidate before this ratchet. Historical execution commits before that point remain immutable and are outside the active enforcement window. New commits after the baseline must carry a canonical EXEC task ID; historical task IDs remain valid attribution even after their task leaves the ACTIVE DISPATCH QUEUE.
