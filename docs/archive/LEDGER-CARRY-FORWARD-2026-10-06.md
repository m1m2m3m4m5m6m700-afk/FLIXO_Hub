# FLIXO — LEDGER CARRY-FORWARD 2026-10-06

## Status
`HISTORICAL / DEFERRED / NON-DISPATCHABLE`

## Live-state reconciliation
Baseline execution SHA at review preparation: `9ced534b3d1ce3a9a2e80176787caa7a66fd4157`.

The live `المهام.md` inspected before this review contained six active cards and had no `§10` section. A repository search did not recover the requested literal `PACK-01..PACK-12` or `TASK-101..TASK-171` payload from the live ledger. Therefore no historical task rows are fabricated here.

## Classification requested for carry-forward material
- PACK-01..PACK-10 and TASK-101..TASK-120 (bots/swarm/reputation): HISTORICAL; not dispatchable and incompatible with the current control model.
- TASK-121..TASK-140 (MVP Prompts 01–20): SUPERSEDED by the current EXEC queue.
- TASK-141..TASK-171 (Pro H1–H18, Tool Waves, full i18n, etc.): DEFERRED as post-MVP roadmap material, outside the ten-capability MVP.
- EXEC-TESTSPRITE-001: DEFERRED / non-gating.

## EXEC-TESTSPRITE-001 — retained text
- **TASK_ID:** EXEC-TESTSPRITE-001
- **TYPE:** VERIFY
- **PRIORITY:** P1
- **OWNER:** QA/Release
- **STATUS:** BLOCKED
- **PR:** none
- **SCOPE:** `testsprite/** + release certification`
- **DEPENDS_ON:** none
- **SOURCE:** `docs/TESTSPRITE-VERIFICATION.md` + release evidence
- **EVIDENCE:** none
- **ACCEPTANCE:** TestSprite executes with required external configuration, or release policy explicitly records it as external BLOCKED without disguising it as GREEN.
- **NEXT_ACTION:** confirm whether required external credentials/configuration are available; never fabricate completion; if unavailable, record as external BLOCKED in release policy.
- **COLLISION_KEY:** `testsprite/** + release certification`

## Reactivation rule
هذا الملف لا ينشئ dispatch. لإعادة تفعيل عنصر: baseline على `execution` الحالي ← تأكيد أنه ما زال مطلوبًا ← ربطه بمصدر حديث واختبار قبول ← إنشاء Task Card جديدة في ACTIVE QUEUE.

## Integrity note
بسبب غياب §10 وPACK/TASK payload من المصدر الحي عند baseline، لا يمكن إجراء diff حرفي لمحتوى غير موجود دون اختلاق تاريخ. تم تسجيل هذا القيد صراحة بدل تعويضه ببيانات مصطنعة.
