# المستكشفون — حزم الاستكشاف المتخصصة

هذا المسار هو الموقع التنظيمي canonical لثلاثة مستكشفين هندسيين متخصصين:
- **مستكشف المعمارية**: Architecture Scout.
- **مستكشف التقنية**: Technology Scout.
- **مستكشف المنظومة**: Ecosystem Scout.

فصل الحزمة عن طبقة التسجيل والتشغيل مقصود:
- `.github/agents/` = تسجيل GitHub القابل للاستدعاء.
- `.agent-intelligence/scouts/` = manifests machine-readable التي تشغّل دورة الاكتشاف.
- `الوكلاء/المستكشفين/` = الهوية، العقد، المهمة، وحدود الوكيل ومخرجاته.
- `.agent-intelligence/inbox/` = بوابة الإدخال append-only.
- `.agent-intelligence/snapshots/` = مصدر الحقيقة غير القابل للاستبدال للأدلة الخارجية.

لا تمنح هذه الحزم أي سلطة تنفيذ أو اعتماد أو certification.
