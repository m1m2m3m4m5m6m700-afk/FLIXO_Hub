# FLIXO — Shared Agent Intelligence / الذاكرة المشتركة

## القرار المعماري

FLIXO يعمل بنموذج **Collective Intelligence** مقيد:

`Agent Local Memory → Evidence → Learning Proposal → Independent Review → Repeated Use → Regression → Shared Knowledge → All Agents`

الوكلاء لا يتشاركون التفكير الخام. المشترك هو المعرفة التشغيلية القابلة للتدقيق: دروس، anti-lessons، heuristics، patterns، warnings، facts.

## طبقات الذاكرة

1. **Local Agent Memory**: خبرة الوكيل المتخصصة وسياق مهمته.
2. **Experience Ledger**: `public.flixo_agent_learning_events` لتسجيل أحداث التعلم الأولية.
3. **Shared Knowledge**: `public.flixo_agent_shared_memory` كمخزن المعرفة المشتركة المرقّى.
4. **Reviews**: `public.flixo_agent_shared_memory_reviews` للتفنيد والتأكيد المستقل.
5. **Usage Feedback**: `public.flixo_agent_shared_memory_usage` لقياس الفائدة/الضرر بعد الاستخدام.
6. **Agent Reports**: مركز الرصد البشري الوحيد هو `الوكلاء/التقارير/<agent>/`.

## قاعدة الثقة

المعلومة لا تصبح `PROMOTED` إلا بعد:
- مصدر واضح وExact-SHA.
- مراجعة مستقلة من وكيل آخر على SHA المصدر.
- تأكيدين مستقلين على الأقل.
- دليل regression.
- استخدامين مفيدين على الأقل في الميدان.
- عدم وجود رفض/تناقض غير محسوم.

`CANDIDATE` و`DISPUTED` و`STALE_EVIDENCE` ليست حقائق تشغيلية.

## Exact-SHA

المعرفة القديمة لا تختفي؛ تصبح `STALE_EVIDENCE` عند اختلاف SHA، وتُعاد معايرتها بدل استخدامها كحقيقة حالية. يمكن رؤيتها كـhypothesis أثناء الاستكشاف، لكن لا تدخل السياق الموثوق للوكيل إلا بعد إعادة التحقق.

## التسميم والمقاومة

- لا يملك الوكيل المُصدر سلطة ترقية معرفته بنفسه.
- المراجع يجب أن يكون مستقلاً عن المصدر.
- كل استخدام يسجل `HELPFUL/HARMFUL/NEUTRAL/NOT_APPLICABLE`.
- الفائدة المتكررة ترفع الثقة، والاستخدام الضار يخفضها.
- المعرفة التي تقترح تغيير authority أو certification تُرفض ولا تستبدل مصادر الحقيقة.
- الاستعلام يعيد `usable=false` لأي معرفة غير `PROMOTED` أو مرتبطة بـSHA مختلف.

## البحث

يدعم المسار الحالي lexical/hybrid-ready عبر PostgreSQL FTS، مع `extensions.vector(384)` وHNSW مُجهزين لإضافة embeddings لاحقًا دون تغيير نموذج البيانات. Supabase توصي بـpgvector وHNSW للبحث الدلالي مع RLS على البيانات المحمية. citeturn797155search4turn797155search8

## التقاط المعرفة من المستكشفين

كل نتيجة استكشاف مهمة تُنتج شيئين:
1. تقرير/اقتراح في `الوكلاء/التقارير/<AGENT-ID> — <name>/`.
2. Learning Proposal يمر عبر `scripts/agent-learning/shared-memory.mjs` إلى طبقة الذاكرة المشتركة.

`.agent-intelligence/inbox/` **ممنوع** لتقارير الوكلاء واقتراحاتهم ونتائجهم.

## واجهة التشغيل

متغيرات التشغيل على worker/backend فقط:
- `SUPABASE_URL` أو `SUPABASE_PROJECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

المفتاح السري لا يدخل المتصفح ولا ملفات التقرير.

الأوامر الموحدة:
```bash
node scripts/agent-learning/shared-memory.mjs search --query "..." --sha "$GITHUB_SHA"
node scripts/agent-learning/shared-memory.mjs propose --file proposal.json
node scripts/agent-learning/shared-memory.mjs review --file review.json
node scripts/agent-learning/shared-memory.mjs use --file usage.json
node scripts/agent-learning/shared-memory.mjs reconcile --file reconcile.json
```

## مصدر الحقيقة

الـGit/CI يحكم الكود والسياسات والـSHA.
Supabase يحكم **حالة الذاكرة المشتركة الحية**.
التقارير في `الوكلاء/التقارير/` تحكم قابلية التتبع البشري.
لا أحد منها يستبدل سلطة الآخر.

## الحوكمة

كل عمليات الذاكرة عبر Supabase مخصصة لـ`service_role` فقط، مع RLS وسياسات صريحة وعدم منح `anon/authenticated` صلاحيات. طبقة RLS يجب أن تبقى مفعلة لأي جدول في schema مكشوف. citeturn797155search0turn797155search3
