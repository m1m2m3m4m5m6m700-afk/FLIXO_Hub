import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { executeAgentPlan, planAgentRequest, type AgentPlan } from '../lib/agent-guided-runtime';

const COPY = {
  en: {
    title: 'FLIXO Agent',
    subtitle: 'Describe an image edit, choose a file, review the plan, then confirm execution.',
    prompt: 'What should FLIXO do?',
    promptPlaceholder: 'e.g. remove the background, convert to WebP, sharpen the image',
    file: 'Choose image',
    plan: 'Build plan',
    execute: 'Execute',
    working: 'Working…',
    ready: 'Plan ready. Execution is local and requires your confirmation.',
    error: 'Agent error',
    result: 'Result',
    download: 'Download result',
    manual: 'Browse manual tools',
    privacy: 'Your image stays in this browser. The Agent receives only prompt text and tool metadata; raw file bytes are never sent to a provider.',
    tool: 'Selected tool',
    confidence: 'Confidence',
    confirm: 'I confirm this local edit',
    language: 'العربية',
  },
  ar: {
    title: 'وكيل FLIXO',
    subtitle: 'اكتب التعديل المطلوب، اختر ملفًا، راجع الخطة، ثم أكد التنفيذ.',
    prompt: 'ماذا تريد من FLIXO أن يفعل؟',
    promptPlaceholder: 'مثال: أزل الخلفية، حوّل إلى WebP، حسّن حدة الصورة',
    file: 'اختر صورة',
    plan: 'إنشاء الخطة',
    execute: 'تنفيذ',
    working: 'جارٍ التنفيذ…',
    ready: 'الخطة جاهزة. التنفيذ محلي ويتطلب تأكيدك.',
    error: 'خطأ الوكيل',
    result: 'النتيجة',
    download: 'تنزيل النتيجة',
    manual: 'تصفح الأدوات اليدوية',
    privacy: 'صورتك تبقى داخل المتصفح. الوكيل يستقبل النص وبيانات الأداة فقط؛ لا تُرسل بيانات الصورة الخام إلى أي مزود.',
    tool: 'الأداة المحددة',
    confidence: 'الثقة',
    confirm: 'أؤكد تنفيذ هذا التعديل محليًا',
    language: 'English',
  },
} as const;

export function AgentPage() {
  const [language, setLanguage] = useState<'en' | 'ar'>('ar');
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; fileName: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const copy = COPY[language];
  const direction = language === 'ar' ? 'rtl' : 'ltr';

  const selectedTool = plan?.steps[0]?.toolId ?? '';
  const statusLabel = useMemo(() => {
    if (busy) return copy.working;
    if (plan) return copy.ready;
    return '';
  }, [busy, copy.ready, copy.working, plan]);

  const buildPlan = async () => {
    if (!file) {
      setError(language === 'ar' ? 'اختر صورة أولًا.' : 'Choose an image first.');
      return;
    }
    try {
      setError('');
      setResult(null);
      setConfirmed(false);
      setPlan(await planAgentRequest(prompt, file));
    } catch (caught) {
      setPlan(null);
      setError(caught instanceof Error ? caught.message : copy.error);
    }
  };

  const runPlan = async () => {
    if (!plan || !file || !confirmed) return;
    setBusy(true);
    setError('');
    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const output = await executeAgentPlan(plan, file, true, controller.signal);
      const extension = output.outputMime === 'image/jpeg' ? 'jpg' : output.outputMime === 'image/webp' ? 'webp' : 'png';
      setResult({
        url: URL.createObjectURL(output.outputBlob),
        fileName: 'flixo-' + plan.steps[0].toolId + '.' + extension,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.error);
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  return (
    <main data-flixo-locale-owner="agent" dir={direction} lang={language === 'ar' ? 'ar' : 'en'} style={{ minHeight: '100vh', padding: '32px 20px', background: 'var(--background, #090d12)', color: 'var(--foreground, #f6f7f9)' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <p className="image-tool-eyebrow">FLIXO · AGENT</p>
            <h1>{copy.title}</h1>
            <p style={{ maxWidth: 760, opacity: 0.8 }}>{copy.subtitle}</p>
          </div>
          <button type="button" onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}>{copy.language}</button>
        </header>

        <section style={{ display: 'grid', gap: 12, padding: 20, border: '1px solid rgba(255,255,255,.12)', borderRadius: 18 }}>
          <label htmlFor="agent-prompt">{copy.prompt}</label>
          <textarea id="agent-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={copy.promptPlaceholder} rows={4} />
          <label htmlFor="agent-file">{copy.file}</label>
          <input id="agent-file" type="file" accept="image/*" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPlan(null); setResult(null); setConfirmed(false); }} />
          <button type="button" onClick={buildPlan} disabled={!prompt.trim() || !file || busy}>{copy.plan}</button>
        </section>

        {plan && (
          <section aria-label="agent-plan" style={{ display: 'grid', gap: 10, padding: 20, border: '1px solid rgba(255,255,255,.12)', borderRadius: 18 }}>
            <strong>{copy.tool}: {selectedTool}</strong>
            <span>{copy.confidence}: {Math.round(plan.confidence * 100)}%</span>
            <span data-testid="agent-plan-status">{statusLabel}</span>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />{copy.confirm}</label>
            <button type="button" onClick={runPlan} disabled={!confirmed || busy}>{copy.execute}</button>
            {busy && <button type="button" onClick={() => abortRef.current?.abort(new DOMException('Agent execution cancelled.', 'AbortError'))}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>}
          </section>
        )}

        {error && <p role="alert">{copy.error}: {error}</p>}

        {result && (
          <section aria-label="agent-result" style={{ display: 'grid', gap: 10, padding: 20, border: '1px solid rgba(255,255,255,.12)', borderRadius: 18 }}>
            <strong>{copy.result}</strong>
            <a download={result.fileName} href={result.url}>{copy.download}</a>
          </section>
        )}

        <p style={{ opacity: 0.72 }}>{copy.privacy}</p>
        <Link to="/">{copy.manual}</Link>
      </div>
    </main>
  );
}

export const agentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agent',
  component: AgentPage,
});
