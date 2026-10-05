import { useEffect, useMemo, useState } from 'react';
import {
  confirmAgentPlan,
  executeAgentPlan,
  planAgentRequest,
  type AgentConfirmationReceipt,
  type AgentPlan,
} from '../lib/agent-guided-runtime';
import './agent-guided-workspace.css';

const copy = {
  en: {
    eyebrow: 'GUIDED AGENT',
    title: 'Tell FLIXO what to do',
    description: 'Upload one image or video, describe the task naturally, review the proposed capability, then confirm execution.',
    prompt: 'What should FLIXO do?',
    promptPlaceholder: 'Example: compress this image to WebP',
    file: 'Source file',
    choose: 'Choose image or video',
    plan: 'Build plan',
    planReady: 'Plan ready',
    confirm: 'Confirm execution',
    execute: 'Run now',
    running: 'Running…',
    reset: 'Reset',
    capability: 'Canonical capability',
    intent: 'Matched intent',
    parameters: 'Parameters',
    confirmation: 'Confirmation required before execution.',
    result: 'Verified result',
    download: 'Download result',
    fallback: 'Use the manual tools',
    error: 'The guided agent could not complete this step.',
  },
  ar: {
    eyebrow: 'الوكيل الموجّه',
    title: 'أخبر FLIXO بما تريد',
    description: 'ارفع صورة أو فيديو، صف المطلوب بلغة طبيعية، راجع الأداة المقترحة ثم أكّد التنفيذ.',
    prompt: 'ماذا تريد من FLIXO؟',
    promptPlaceholder: 'مثال: اضغط هذه الصورة بصيغة WebP',
    file: 'الملف المصدر',
    choose: 'اختر صورة أو فيديو',
    plan: 'إنشاء الخطة',
    planReady: 'الخطة جاهزة',
    confirm: 'تأكيد التنفيذ',
    execute: 'تنفيذ الآن',
    running: 'جارٍ التنفيذ…',
    reset: 'إعادة ضبط',
    capability: 'القدرة التنفيذية المعتمدة',
    intent: 'النية المطابقة',
    parameters: 'المعاملات',
    confirmation: 'يتطلب التنفيذ تأكيدًا صريحًا أولًا.',
    result: 'نتيجة موثقة',
    download: 'تنزيل النتيجة',
    fallback: 'استخدم الأدوات اليدوية',
    error: 'تعذر على الوكيل الموجّه إكمال الخطوة.',
  },
} as const;

export function AgentGuidedWorkspace({ locale }: { locale?: string }) {
  const lang = (locale ?? (typeof document !== 'undefined' ? document.documentElement.lang : 'en'))
    .toLowerCase()
    .startsWith('ar')
    ? 'ar'
    : 'en';
  const t = copy[lang];
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [receipt, setReceipt] = useState<AgentConfirmationReceipt | null>(null);
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  const serializedParameters = useMemo(
    () => (plan ? JSON.stringify(plan.steps[0]?.params ?? {}, null, 2) : ''),
    [plan],
  );

  const reset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setFile(null);
    setPrompt('');
    setPlan(null);
    setReceipt(null);
    setResult(null);
    setResultUrl('');
    setError('');
    setBusy(false);
  };

  const buildPlan = () => {
    setError('');
    setReceipt(null);
    setResult(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl('');
    }
    if (!file) {
      setError(t.choose);
      return;
    }
    if (!prompt.trim()) {
      setError(t.prompt);
      return;
    }
    try {
      setPlan(planAgentRequest(prompt, file));
    } catch (cause) {
      setPlan(null);
      setError(cause instanceof Error ? cause.message : t.error);
    }
  };

  const confirmPlan = () => {
    if (!plan || !file) return;
    setError('');
    try {
      setReceipt(confirmAgentPlan(plan, file));
    } catch (cause) {
      setReceipt(null);
      setError(cause instanceof Error ? cause.message : t.error);
    }
  };

  const execute = async () => {
    if (!plan || !file || !receipt || busy) return;
    setBusy(true);
    setError('');
    try {
      const output = await executeAgentPlan(plan, file, receipt);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResult(output);
      setResultUrl(URL.createObjectURL(output.blob));
      setReceipt(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.error);
    } finally {
      setBusy(false);
    }
  };

  const direction = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <section className="agent-guided-workspace" dir={direction} aria-label="Agent Guided MVP">
      <div className="agent-guided-workspace__header">
        <div>
          <span className="agent-guided-workspace__eyebrow">{t.eyebrow}</span>
          <h2>{t.title}</h2>
          <p>{t.description}</p>
        </div>
        <span className="agent-guided-workspace__badge">LOCAL · CANONICAL</span>
      </div>

      <div className="agent-guided-workspace__grid">
        <div className="agent-guided-workspace__card">
          <label className="agent-guided-workspace__field">
            <span>{t.prompt}</span>
            <textarea
              data-testid="agent-guided-prompt"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                setPlan(null);
                setReceipt(null);
                setError('');
              }}
              placeholder={t.promptPlaceholder}
              rows={4}
            />
          </label>

          <label className="agent-guided-workspace__file">
            <span>{t.file}</span>
            <input
              data-testid="agent-guided-file"
              type="file"
              accept="image/*,video/*"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPlan(null);
                setReceipt(null);
                setResult(null);
                setError('');
              }}
            />
            <small>{file?.name ?? t.choose}</small>
          </label>

          <div className="agent-guided-workspace__actions">
            <button type="button" className="agent-guided-workspace__primary" onClick={buildPlan} disabled={busy}>
              {t.plan}
            </button>
            <button type="button" onClick={reset} disabled={busy}>
              {t.reset}
            </button>
          </div>

          {error && (
            <div className="agent-guided-workspace__error" role="alert">
              <strong>{t.error}</strong>
              <span>{error}</span>
              <a href={lang === 'ar' ? '/ar/tools' : '/en/tools'}>{t.fallback}</a>
            </div>
          )}
        </div>

        <div className="agent-guided-workspace__card agent-guided-workspace__plan" data-testid="agent-guided-plan">
          {plan ? (
            <>
              <div className="agent-guided-workspace__state">
                <span>{t.planReady}</span>
                <strong>CONFIRM</strong>
              </div>
              <dl>
                <div><dt>{t.capability}</dt><dd data-testid="agent-guided-tool-id">{plan.steps[0]?.toolId}</dd></div>
                <div><dt>{t.intent}</dt><dd>{plan.matchedIntent}</dd></div>
              </dl>
              <label className="agent-guided-workspace__params">
                <span>{t.parameters}</span>
                <pre>{serializedParameters}</pre>
              </label>

              {!receipt ? (
                <div className="agent-guided-workspace__confirmation">
                  <p>{t.confirmation}</p>
                  <button type="button" className="agent-guided-workspace__primary" onClick={confirmPlan}>
                    {t.confirm}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="agent-guided-workspace__primary"
                  onClick={() => void execute()}
                  disabled={busy}
                >
                  {busy ? t.running : t.execute}
                </button>
              )}

              {result && resultUrl && (
                <div className="agent-guided-workspace__result" role="status" aria-live="polite" aria-label={t.result}>
                  <div>
                    <span>{t.result}</span>
                    <strong>{result.fileName}</strong>
                  </div>
                  <a href={resultUrl} download={result.fileName}>{t.download}</a>
                </div>
              )}
            </>
          ) : (
            <div className="agent-guided-workspace__empty">
              <strong>{t.plan}</strong>
              <span>{t.description}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
