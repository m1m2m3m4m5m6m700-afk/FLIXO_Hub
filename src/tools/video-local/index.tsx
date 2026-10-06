import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { getCanonicalCapabilityDefinition, validateCapabilityParameters } from '@/config/manual-capability-definition';
import { getVideoToolExecutor } from '@/lib/video/video-tool-executors';
import { inspectVideoMetadata, type VideoMetadata } from '@/lib/video/video-executor';

type VideoToolId = 'video-trimmer' | 'video-cropper' | 'video-resizer' | 'video-compressor';
type Parameters = Record<string, string | number | undefined>;

const COPY = {
  en: {
    choose: 'Choose video',
    process: 'Process video',
    processing: 'Processing…',
    start: 'Start time (seconds)',
    end: 'End time (seconds)',
    x: 'X',
    y: 'Y',
    width: 'Width',
    height: 'Height',
    fps: 'FPS',
    videoBitrate: 'Video bitrate (bps)',
    audioBitrate: 'Audio bitrate (bps)',
    result: 'Result',
    download: 'Download result',
    local: 'Local browser video execution. The original file is not modified or uploaded.',
    invalid: 'The selected video is not supported or exceeds the browser safety limits.',
    noResult: 'No result yet.',
  },
  ar: {
    choose: 'اختر فيديو',
    process: 'معالجة الفيديو',
    processing: 'جارٍ المعالجة…',
    start: 'بداية القص (ثانية)',
    end: 'نهاية القص (ثانية)',
    x: 'X',
    y: 'Y',
    width: 'العرض',
    height: 'الارتفاع',
    fps: 'الإطارات/ث',
    videoBitrate: 'معدل بت الفيديو',
    audioBitrate: 'معدل بت الصوت',
    result: 'النتيجة',
    download: 'تنزيل النتيجة',
    local: 'المعالجة تتم محليًا داخل المتصفح. لا يتم تعديل الملف الأصلي أو رفعه.',
    invalid: 'الفيديو المحدد غير مدعوم أو يتجاوز حدود الأمان في المتصفح.',
    noResult: 'لا توجد نتيجة بعد.',
  },
} as const;

export function VideoLocalTool() {
  const location = useLocation();
  const id = String(location.pathname).split('/').pop() as VideoToolId;
  const [file, setFile] = useState<File | null>(null);
  const [inputMeta, setInputMeta] = useState<VideoMetadata | null>(null);
  const [parameters, setParameters] = useState<Parameters>({});
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const locale = typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const copy = COPY[locale];

  useEffect(() => () => {
    abortRef.current?.abort();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  const defaults = useMemo(() => {
    if (!inputMeta) return {};
    if (id === 'video-trimmer') return { startSec: 0, endSec: Number(inputMeta.duration.toFixed(3)) };
    if (id === 'video-cropper') return { x: 0, y: 0, width: inputMeta.width, height: inputMeta.height };
    if (id === 'video-resizer') return { width: inputMeta.width, height: inputMeta.height, fps: 30 };
    return { videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 };
  }, [id, inputMeta]);

  const mergedParameters = { ...defaults, ...parameters };

  const updateParameter = (key: string, value: string) => {
    setParameters((current) => ({ ...current, [key]: value }));
  };

  const handleFileChange = async (nextFile: File | null) => {
    abortRef.current?.abort();
    setFile(nextFile);
    setResult(null);
    setError('');
    setInputMeta(null);
    setParameters({});
    if (!nextFile) return;
    try {
      const metadata = await inspectVideoMetadata(nextFile);
      setInputMeta(metadata);
    } catch {
      setFile(null);
      setError(copy.invalid);
    }
  };

  const run = async () => {
    if (!file || !inputMeta) {
      setError(copy.invalid);
      return;
    }

    const definition = getCanonicalCapabilityDefinition(id);
    const executor = getVideoToolExecutor({ id });
    if (!definition || !executor) {
      setError('VIDEO_EXECUTOR_UNAVAILABLE');
      return;
    }

    setBusy(true);
    setError('');
    setResult(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const validated = validateCapabilityParameters(id, mergedParameters as Record<string, string | number | boolean>);
      const output = await executor(file, validated, { id }, controller.signal);
      const verified = await definition.verifier(file, output, validated, controller.signal);
      if (!verified) throw new Error('VIDEO_OUTPUT_VERIFICATION_FAILED');
      const verifiedMeta = await inspectVideoMetadata(output, controller.signal);
      setResult(output);
      setResultUrl(URL.createObjectURL(output));
      if (verifiedMeta.size <= 0) throw new Error('VIDEO_OUTPUT_INVALID');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        setError('VIDEO_OPERATION_ABORTED');
      } else {
        setError(cause instanceof Error ? cause.message : 'VIDEO_PROCESSING_FAILED');
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  };

  const fields = id === 'video-trimmer'
    ? [['startSec', copy.start], ['endSec', copy.end]]
    : id === 'video-cropper'
      ? [['x', copy.x], ['y', copy.y], ['width', copy.width], ['height', copy.height]]
      : id === 'video-resizer'
        ? [['width', copy.width], ['height', copy.height], ['fps', copy.fps]]
        : [['videoBitsPerSecond', copy.videoBitrate], ['audioBitsPerSecond', copy.audioBitrate]];

  return (
    <section aria-label="Local video processing" style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h2>Local video processing</h2>
      <p>{copy.local}</p>
      <input aria-label={copy.choose} type="file" accept="video/webm,video/mp4,video/ogg" onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)} />
      {inputMeta && <p>{inputMeta.width} × {inputMeta.height}px · {inputMeta.duration.toFixed(2)}s · {Math.round(inputMeta.size / 1024)} KB</p>}
      {file && (
        <div>
          {fields.map(([key, label]) => (
            <label key={key} style={{ display: 'block', marginTop: 8 }}>
              <span>{label}</span>
              <input
                aria-label={label}
                inputMode="decimal"
                value={String(mergedParameters[key] ?? '')}
                onChange={(event) => updateParameter(key, event.target.value)}
                disabled={busy}
              />
            </label>
          ))}
        </div>
      )}
      <button type="button" disabled={!file || !inputMeta || busy} onClick={() => void run()}>{busy ? copy.processing : copy.process}</button>
      {error && <p role="alert">{error}</p>}
      <section aria-live="polite">
        <h3>{copy.result}</h3>
        {resultUrl ? <a download="flixo-video-output.webm" href={resultUrl}>{copy.download}</a> : <p>{copy.noResult}</p>}
      </section>
    </section>
  );
}
