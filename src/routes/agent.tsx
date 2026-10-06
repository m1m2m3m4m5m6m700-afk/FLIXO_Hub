import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  confirmAgentPlan,
  executeAgentPlan,
  planAgentRequest,
  revokeAgentConfirmation,
  type AgentConfirmationReceipt,
  type AgentPlan,
} from '../lib/agent-guided-runtime';

const COPY = {
  en: {
    title: 'FLIXO Agent',
    subtitle: 'Describe an image or video edit, choose a file, review the plan, then confirm execution.',
    prompt: 'What should FLIXO do?',
    promptPlaceholder: 'e.g. remove the background, convert to WebP, sharpen an image, or trim a video',
    file: 'Choose image or video',
    plan: 'Build plan',
    execute: 'Execute',
    cancel: 'Cancel',
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
    subtitle: 'اكتب تعديل الصورة أو الفيديو، اختر ملفًا، راجع الخطة، ثم أكد التنفيذ.',
    prompt: 'ماذا تريد من FLIXO أن يفعل؟',
    promptPlaceholder: 'مثال: أزل الخلفية، حوّل إلى WebP، حسّن حدة الصورة، أو اقتطع الفيديو',
    file: 'اختر صورة أو فيديو',
    plan: 'إنشاء الخطة',
    execute: 'تنفيذ',
    cancel: 'إلغاء',
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
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [confirmationReceipt, setConfirmationReceipt] = useState<AgentConfirmationReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; fileName: string } | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const resultUrl = useRef<string | null>(null);
  const copy = COPY[language];
  const direction = language === 'ar' ? 'rtl' : 'ltr';

  const selectedTools = plan?.steps.map((step) => step.toolId) ?? [];
  const statusLabel = useMemo(() => {
    if (busy) return copy.working;
    if (plan) return copy.ready;
    return '';
  }, [busy, copy.ready, copy.working, plan]);

  const clearResult = () => {
    if (resultUrl.current) {
      URL.revokeObjectURL(resultUrl.current);
      resultUrl.current = null;
    }
    setResult(null);
  };

  const buildPlan = () => {
    if (!file) {
      setError(language === 'ar' ? 'اختر صورة أو فيديو أولًا.' : 'Choose an image or video first.');
      return;
    }
    try {
      setError('');
      clearResult();
      revokeAgentConfirmation(confirmationReceipt);
      setConfirmationReceipt(null);
      setPlan(planAgentRequest(prompt, file));
    } catch (caught) {
      setPlan(null);
      setError(caught instanceof Error ? caught.message : copy.error);
    }
  };

  const toggleConfirmation = (checked: boolean) => {
    revokeAgentConfirmation(confirmationReceipt);
    setConfirmationReceipt(null);
    if (!checked || !plan || !file) return;
    try {
      setError('');
      setConfirmationReceipt(confirmAgentPlan(plan, file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.error);
    }
  };

  const runPlan = async () => {
    if (!plan || !file || !confirmationReceipt) return;
    const controller = new AbortController();
    abortController.current = controller;
    setBusy(true);
    setError('');
    clearResult();
    try {
      const output = await executeAgentPlan(plan, file, confirmationReceipt, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(output.blob);
      resultUrl.current = url;
      setResult({ url, fileName: output.fileName });
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === 'AbortError')) {
        setError(language === 'ar' ? 'تم إلغاء التنفيذ.' : 'Execution cancelled.');
      } else {
        setError(caught instanceof Error ? caught.message : copy.error);
      }
    } finally {
      abortController.current = null;
      setBusy(false);
      revokeAgentConfirmation(confirmationReceipt);
      setConfirmationReceipt(null);
    }
  };

  const cancelExecution = () => {
    abortController.current?.abort();
  };

  return (
    <main dir={direction} lang={language === 'ar' ? 'ar' : 'en'} style={{ minHeight: '100vh', padding: '32px 20px', background: 'var(--background, #090d12)', color: 'var(--foreground, #f6f7f9)' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <p className="image-tool-eyebrow">FLIXO · AGENT</p>
            <h1>{copy.title}</h1>
            <p style={{ maxWidth: 760, opacity: 0.8 }}>{copy.subtitle}</p>
          </div>
          <button type="button" data-testid="agent-language-toggle" onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}>{copy.language}</button>
        </header>

        <section style={{ display: 'grid', gap: 12, padding: 20, border: '1px solid rgba(255,255,255,.12)', borderRadius: 18 }}>
          <label htmlFor="agent-prompt">{copy.prompt}</label>
          <textarea
            id="agent-prompt"
            value={prompt}
            disabled={busy}
            onChange={(event) => {
              const nextPrompt = event.target.value;
              if (nextPrompt !== prompt) {
                revokeAgentConfirmation(confirmationReceipt);
                setConfirmationReceipt(null);
                setPlan(null);
                clearResult();
                setError('');
              }
              setPrompt(nextPrompt);
            }}
            placeholder={copy.promptPlaceholder}
            rows={4}
          />
          <label htmlFor="agent-file">{copy.file}</label>
          <input id="agent-file" type="file" accept="image/*,video/*" disabled={busy} onChange={(event) => {
            revokeAgentConfirmation(confirmationReceipt);
            setConfirmationReceipt(null);
            setFile(event.target.files?.[0] ?? null);
            setPlan(null);
            clearResult();
            setError('');
          }} />
          <button type="button" data-testid="agent-build-plan" onClick={buildPlan} disabled={!prompt.trim() || !file || busy}>{copy.plan}</button>
        </section>

        {plan && (
          <section aria-label="agent-plan" style={{ display: 'grid', gap: 10, padding: 20, border: '1px solid rgba(255,255,255,.12)', borderRadius: 18 }}>
            <strong>{copy.tool}: <span data-testid="agent-plan-steps">{selectedTools.join(' → ')}</span></strong>
            <span>{copy.confidence}: {Math.round(plan.confidence * 100)}%</span>
            <span data-testid="agent-plan-status">{statusLabel}</span>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" data-testid="agent-confirmation" checked={confirmationReceipt !== null} onChange={(event) => toggleConfirmation(event.target.checked)} />
              {copy.confirm}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" data-testid="agent-execute" onClick={runPlan} disabled={confirmationReceipt === null || busy}>{copy.execute}</button>
              {busy && <button type="button" data-testid="agent-cancel" onClick={cancelExecution}>{copy.cancel}</button>}
            </div>
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