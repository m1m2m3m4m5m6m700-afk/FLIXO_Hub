# FLIXO — LEDGER CARRY-FORWARD 2026-10-06

## Classification Header

This archive is HISTORICAL/DEFERRED and is not dispatchable.

Baseline inspected: `execution` SHA `3f3096ccda88aae38dd0a998c6275c0a6fa77ffc`.

Important live-state finding: the inspected `المهام.md` at the baseline SHA contains no section `§10` and no literal `PACK-01..PACK-12`, `TASK-101..TASK-171`, or `EXEC-TESTSPRITE-001` entries. Therefore the requested "copy §10 verbatim" cannot be truthfully performed from the live source. No missing historical rows are invented here.

## Requested classification

- PACK-01..PACK-10 and TASK-101..TASK-120 (bots/swarm/reputation): HISTORICAL; they conflict with the current repository control model.
- TASK-121..TASK-140 (MVP Prompts 01–20): SUPERSEDED by the current EXEC cards.
- TASK-141..TASK-171 (Pro H1–H18, Tool Waves, full i18n, etc.): DEFERRED as post-MVP roadmap material, outside the ten-capability MVP.
- EXEC-TESTSPRITE-001: DEFERRED / non-gating.

## EXEC-TESTSPRITE-001 — retained card text

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

## Carry-forward rule

لا ينشئ هذا الملف أي dispatch. لإعادة تفعيل أي عنصر: baseline على `execution` الحالي ← تأكيد أنه ما زال مطلوبًا ← ربطه بمصدر حديث واختبار قبول ← إنشاء Task Card جديدة في ACTIVE QUEUE.

## Historical-content integrity note

Because the live source had no §10 at the inspected baseline, there is no literal PACK/TASK payload to diff-copy without fabricating repository history. This note is itself part of the historical reconciliation evidence.
