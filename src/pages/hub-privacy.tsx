const COPY = {
  ar: {
    title: 'خصوصية FLIXO Hub',
    body: 'المعالجة في Hub مصممة لتبقى داخل متصفحك. مسار المعالجة المحلي لا يرفع ملفات المستخدم إلى خادم معالجة.',
    points: [
      'الملف يدخل Worker محليًا عبر ArrayBuffer قابل للنقل.',
      'OPFS هو المخزن الأساسي للملفات الوسيطة الكبيرة عند توفره.',
      'عند غياب OPFS، يستخدم Hub ذاكرة الجلسة بدل خدمة سحابية.',
      'لا يستخدم Hub cookies أو localStorage للملفات أو معرفات التتبع.',
    ],
    back: 'العودة إلى Hub',
  },
  en: {
    title: 'FLIXO Hub privacy',
    body: 'Hub processing is designed to remain inside your browser. The local processing path does not upload user files to a processing server.',
    points: [
      'Files enter local Workers through transferable ArrayBuffers.',
      'OPFS is the primary store for large intermediate files when supported.',
      'When OPFS is unavailable, Hub uses session memory instead of a cloud service.',
      'Hub does not use cookies or localStorage for files or tracking identifiers.',
    ],
    back: 'Back to Hub',
  },
} as const;

export function HubPrivacy({ locale = 'ar' as 'ar' | 'en' }) {
  const copy = COPY[locale];
  return (
    <main className="hub-shell" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <article className="hub-container hub-privacy">
        <a href={locale === 'ar' ? '/hub' : '/en/hub'}>{copy.back}</a>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <ul>{copy.points.map((point) => <li key={point}>{point}</li>)}</ul>
      </article>
    </main>
  );
}
