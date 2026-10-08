import { useEffect, useRef, useState } from 'react';
import { detectHubFeatures, type HubFeatureSnapshot } from '../core/feature-detection';
import { HubWorkerPool } from '../core/worker-pool';
import { hubBinaryStore } from '../core/opfs-store';
import '../hub.css';

type DemoResult = Readonly<{ byteLength: number; checksum: number }>;

const COPY = {
  ar: {
    title: 'FLIXO Hub',
    lead: 'أدوات ملفات تعمل محليًا داخل متصفحك.',
    choose: 'اختر ملفًا تجريبيًا',
    run: 'شغّل المعالجة المحلية',
    cancel: 'إلغاء',
    progress: 'التقدم',
    features: 'قدرات المتصفح',
    local: 'لا تُرفع الملفات إلى خادم المعالجة.',
    stored: 'تم حفظ النتيجة محليًا.',
    privacy: 'الخصوصية',
  },
  en: {
    title: 'FLIXO Hub',
    lead: 'Browser-local file tools with a privacy-first processing boundary.',
    choose: 'Choose a file',
    run: 'Run local processing',
    cancel: 'Cancel',
    progress: 'Progress',
    features: 'Browser capabilities',
    local: 'Files stay in your browser; there is no file-processing server.',
    stored: 'Demo result stored locally.',
    privacy: 'Privacy',
  },
} as const;

function useHubWorker() {
  const poolRef = useRef<HubWorkerPool | null>(null);
  useEffect(() => {
    const pool = new HubWorkerPool(
      () => new Worker(new URL('../core/hub-demo.worker.ts', import.meta.url), { type: 'module' }),
      1,
    );
    poolRef.current = pool;
    return () => {
      pool.dispose();
      poolRef.current = null;
    };
  }, []);
  return poolRef;
}

export function HubHome({ locale = 'ar' as 'ar' | 'en' }: { locale?: 'ar' | 'en' }) {
  const copy = COPY[locale];
  const [features] = useState<HubFeatureSnapshot>(() => detectHubFeatures());
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [stored, setStored] = useState(false);
  const activeTask = useRef<{ cancel: () => void } | null>(null);
  const poolRef = useHubWorker();

  const run = async () => {
    if (!file || !poolRef.current || active) return;
    const buffer = await file.arrayBuffer();
    setError(null);
    setResult(null);
    setStored(false);
    setProgress(0);
    setActive(true);

    const task = poolRef.current.submit<{ buffer: ArrayBuffer }, DemoResult>(
      { buffer },
      [buffer],
      { onProgress: ({ progress: value }) => setProgress(value) },
    );
    activeTask.current = task;

    try {
      setResult(await task.promise);
      setProgress(1);
    } catch (reason: unknown) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError(reason instanceof Error ? reason.message : 'Worker task failed.');
      }
    } finally {
      activeTask.current = null;
      setActive(false);
    }
  };

  const cancel = () => activeTask.current?.cancel();

  const storeResult = async () => {
    if (!result) return;
    const payload = new Blob([JSON.stringify(result)], { type: 'application/json' });
    await hubBinaryStore.write('hub-demo-result.json', payload);
    setStored(true);
  };

  return (
    <main className="hub-shell" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <section className="hub-container">
        <header className="hub-header">
          <span className="hub-badge">FLIXO · HUB</span>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
          <div className="hub-proof">{copy.local}</div>
        </header>

        <section className="hub-card" aria-labelledby="hub-workspace-title">
          <h2 id="hub-workspace-title">{locale === 'ar' ? 'اختبار معالجة محلية' : 'Local processing test'}</h2>
          <label>
            <span className="hub-label">{copy.choose}</span>
            <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <div className="hub-actions">
            <button type="button" onClick={() => void run()} disabled={!file || active}>{copy.run}</button>
            <button type="button" onClick={cancel} disabled={!active}>{copy.cancel}</button>
          </div>
          <div className="hub-progress" aria-live="polite">
            <div className="hub-progress-track" aria-hidden="true"><span style={{ width: Math.round(progress * 100) + '%' }} /></div>
            <span>{copy.progress}: {Math.round(progress * 100)}%</span>
          </div>
          {result && <output className="hub-result">✓ {result.byteLength.toLocaleString()} bytes · checksum {result.checksum}</output>}
          {error && <p className="hub-error" role="alert">{error}</p>}
        </section>

        <section className="hub-card" aria-labelledby="hub-features-title">
          <h2 id="hub-features-title">{copy.features}</h2>
          <dl className="hub-feature-grid">
            {Object.entries(features).map(([key, value]) => (
              <div key={key}><dt>{key}</dt><dd>{value ? '✓' : 'fallback'}</dd></div>
            ))}
          </dl>
        </section>

        <section className="hub-card hub-note" aria-labelledby="hub-storage-title">
          <h2 id="hub-storage-title">{locale === 'ar' ? 'التخزين المحلي' : 'Local storage'}</h2>
          <p>{locale === 'ar' ? 'يستخدم Hub OPFS عند توفره، وإلا يستخدم ذاكرة الجلسة.' : 'Hub uses OPFS when available and session memory otherwise.'}</p>
          <button type="button" onClick={() => void storeResult()} disabled={!result}>{locale === 'ar' ? 'احفظ نتيجة الاختبار' : 'Store demo result'}</button>
          {stored && <output className="hub-result" aria-live="polite">✓ {copy.stored}</output>}
        </section>

        <footer className="hub-footer">
          <a href={locale === 'ar' ? '/hub/privacy' : '/en/hub/privacy'}>{copy.privacy}</a>
        </footer>
      </section>
    </main>
  );
}
