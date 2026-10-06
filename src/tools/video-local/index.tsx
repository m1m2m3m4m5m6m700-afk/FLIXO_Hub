import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { executeCanonicalTool } from '@/lib/execution/canonical-executor';
import type { CanonicalCapabilityParameters } from '@/config/manual-capability-definition';

type VideoToolId = 'video-trimmer' | 'video-cropper' | 'video-resizer' | 'video-compressor';
type VideoFormState = {
  startSec: string;
  endSec: string;
  x: string;
  y: string;
  width: string;
  height: string;
  fps: string;
  videoBitsPerSecond: string;
  audioBitsPerSecond: string;
};

const COPY = {
  en: {
    title: {
      'video-trimmer': 'Video Trimmer',
      'video-cropper': 'Video Cropper',
      'video-resizer': 'Video Resizer',
      'video-compressor': 'Video Compressor',
    },
    description: {
      'video-trimmer': 'Trim the start and end of a video locally in your browser.',
      'video-cropper': 'Crop a video to an exact rectangle locally in your browser.',
      'video-resizer': 'Resize a video to exact output dimensions locally in your browser.',
      'video-compressor': 'Reduce video bitrate locally without uploading the source.',
    },
    choose: 'Choose video',
    drop: 'Drop a video here or browse your device',
    processing: 'Processing…',
    run: 'Process video',
    reset: 'Reset',
    result: 'Verified result',
    download: 'Download result',
    source: 'Source video',
    output: 'Output video',
    start: 'Start (seconds)',
    end: 'End (seconds)',
    x: 'Crop X',
    y: 'Crop Y',
    width: 'Width',
    height: 'Height',
    fps: 'FPS',
    videoBitrate: 'Video bitrate',
    audioBitrate: 'Audio bitrate',
    loaded: 'Loaded',
    noResult: 'No result yet.',
    ready: 'Ready',
    verifying: 'Executing and verifying locally…',
    invalidVideo: 'Select a supported video file.',
    size: 'Size',
    type: 'Type',
  },
  ar: {
    title: {
      'video-trimmer': 'قص الفيديو',
      'video-cropper': 'قص إطار الفيديو',
      'video-resizer': 'تغيير حجم الفيديو',
      'video-compressor': 'ضغط الفيديو',
    },
    description: {
      'video-trimmer': 'قص بداية الفيديو ونهايته محليًا داخل المتصفح.',
      'video-cropper': 'قص الفيديو إلى مستطيل بأبعاد محددة محليًا داخل المتصفح.',
      'video-resizer': 'غيّر أبعاد الفيديو إلى مقاس إخراج محدد محليًا داخل المتصفح.',
      'video-compressor': 'خفّض معدل بت الفيديو محليًا من دون رفع الملف الأصلي.',
    },
    choose: 'اختر فيديو',
    drop: 'اسحب فيديو هنا أو اختره من جهازك',
    processing: 'جارٍ المعالجة…',
    run: 'معالجة الفيديو',
    reset: 'إعادة ضبط',
    result: 'نتيجة تم التحقق منها',
    download: 'تنزيل النتيجة',
    source: 'الفيديو الأصلي',
    output: 'الفيديو الناتج',
    start: 'البداية (بالثواني)',
    end: 'النهاية (بالثواني)',
    x: 'X للقص',
    y: 'Y للقص',
    width: 'العرض',
    height: 'الارتفاع',
    fps: 'الإطارات/ثانية',
    videoBitrate: 'معدل بت الفيديو',
    audioBitrate: 'معدل بت الصوت',
    loaded: 'تم التحميل',
    noResult: 'لا توجد نتيجة بعد.',
    ready: 'جاهز',
    verifying: 'جارٍ التنفيذ والتحقق محليًا…',
    invalidVideo: 'اختر ملف فيديو مدعومًا.',
    size: 'الحجم',
    type: 'النوع',
  },
} as const;

const DEFAULTS: Record<VideoToolId, VideoFormState> = {
  'video-trimmer': { startSec: '0', endSec: '', x: '0', y: '0', width: '320', height: '180', fps: '15', videoBitsPerSecond: '500000', audioBitsPerSecond: '128000' },
  'video-cropper': { startSec: '0', endSec: '', x: '0', y: '0', width: '320', height: '180', fps: '15', videoBitsPerSecond: '500000', audioBitsPerSecond: '128000' },
  'video-resizer': { startSec: '0', endSec: '', x: '0', y: '0', width: '320', height: '180', fps: '15', videoBitsPerSecond: '500000', audioBitsPerSecond: '128000' },
  'video-compressor': { startSec: '0', endSec: '', x: '0', y: '0', width: '320', height: '180', fps: '15', videoBitsPerSecond: '500000', audioBitsPerSecond: '128000' },
};

function numberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) throw new Error('Parameter values must be finite numbers.');
  return parsed;
}

function positiveInt(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function nonNegativeNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative number.`);
  return parsed;
}

export function VideoLocalTool() {
  const location = useLocation();
  const id = String(location.pathname).split('/').pop() as VideoToolId;
  const toolId: VideoToolId = id in DEFAULTS ? id : 'video-trimmer';
  const locale = String(location.pathname).split('/').filter(Boolean)[0] === 'ar' ? 'ar' : 'en';
  const ui = COPY[locale];
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [parameters, setParameters] = useState<VideoFormState>(() => ({ ...DEFAULTS[toolId] }));
  const resultUrlRef = useRef<string | null>(null);
  const fileUrlRef = useRef<string | null>(null);

  const title = ui.title[toolId];
  const description = ui.description[toolId];

  useEffect(() => {
    setParameters({ ...DEFAULTS[toolId] });
    setFile(null);
    setResult(null);
    setError('');
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    resultUrlRef.current = null;
    fileUrlRef.current = null;
    setResultUrl(null);
    setFileUrl(null);
  }, [toolId]);

  useEffect(() => () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
  }, []);

  const acceptFile = (next: File | null) => {
    if (!next) return;
    if (!next.type.startsWith('video/')) {
      setError(ui.invalidVideo);
      return;
    }
    if (next.size <= 0) {
      setError(ui.invalidVideo);
      return;
    }
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = URL.createObjectURL(next);
    setFileUrl(fileUrlRef.current);
    setFile(next);
    setError('');
    clearResult();
  };

  const clearResult = () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResultUrl(null);
    setResult(null);
  };

  const buildParameters = (): CanonicalCapabilityParameters => {
    if (toolId === 'video-trimmer') {
      const startSec = nonNegativeNumber(parameters.startSec, ui.start);
      const endSec = numberOrUndefined(parameters.endSec);
      if (endSec !== undefined && endSec <= startSec) throw new Error(locale === 'ar' ? 'يجب أن تكون النهاية أكبر من البداية.' : 'End must be greater than start.');
      return { startSec, ...(endSec !== undefined ? { endSec } : {}) };
    }
    if (toolId === 'video-cropper') {
      return {
        x: nonNegativeNumber(parameters.x, ui.x),
        y: nonNegativeNumber(parameters.y, ui.y),
        width: positiveInt(parameters.width, ui.width),
        height: positiveInt(parameters.height, ui.height),
      };
    }
    if (toolId === 'video-resizer') {
      return {
        width: positiveInt(parameters.width, ui.width),
        height: positiveInt(parameters.height, ui.height),
        fps: positiveInt(parameters.fps, ui.fps),
      };
    }
    return {
      videoBitsPerSecond: positiveInt(parameters.videoBitsPerSecond, ui.videoBitrate),
      audioBitsPerSecond: positiveInt(parameters.audioBitsPerSecond, ui.audioBitrate),
    };
  };

  const run = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    clearResult();
    try {
      const output = await executeCanonicalTool(toolId, { blob: file, fileName: file.name }, buildParameters());
      const url = URL.createObjectURL(output.blob);
      resultUrlRef.current = url;
      setResult(output.blob);
      setResultUrl(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (locale === 'ar' ? 'تعذر معالجة الفيديو.' : 'Video processing failed.'));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (busy) return;
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = null;
    setFileUrl(null);
    clearResult();
    setFile(null);
    setError('');
    setParameters({ ...DEFAULTS[toolId] });
  };

  const fields = useMemo(() => {
    if (toolId === 'video-trimmer') return [
      ['startSec', ui.start, true], ['endSec', ui.end, false],
    ] as const;
    if (toolId === 'video-cropper') return [
      ['x', ui.x, true], ['y', ui.y, true], ['width', ui.width, true], ['height', ui.height, true],
    ] as const;
    if (toolId === 'video-resizer') return [
      ['width', ui.width, true], ['height', ui.height, true], ['fps', ui.fps, true],
    ] as const;
    return [
      ['videoBitsPerSecond', ui.videoBitrate, true], ['audioBitsPerSecond', ui.audioBitrate, true],
    ] as const;
  }, [toolId, ui]);

  return (
    <main lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="video-tool-title" style={{ maxWidth: 1080, margin: '0 auto', padding: 24 }}>
      <header>
        <p style={{ opacity: 0.7 }}>FLIXO Hub · {ui.ready}</p>
        <h2 id="video-tool-title">{title}</h2>
        <p>{description}</p>
      </header>

      <section aria-label={ui.source} style={{ display: 'grid', gap: 16 }}>
        <label
          htmlFor="video-tool-file"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            acceptFile(event.dataTransfer.files?.[0] ?? null);
          }}
          style={{ display: 'grid', gap: 8, padding: 20, border: '1px dashed currentColor', borderRadius: 12, cursor: 'pointer' }}
        >
          <strong>{file ? file.name : ui.drop}</strong>
          <span>{ui.choose}</span>
        </label>
        <input
          id="video-tool-file"
          data-testid="video-file-input"
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
        />
      </section>

      {file && fileUrl && (
        <section aria-label={ui.source} style={{ marginTop: 20 }}>
          <video controls preload="metadata" src={fileUrl} style={{ width: '100%', maxHeight: 420 }} />
          <p>{ui.loaded} · {ui.type}: {file.type || 'video/*'} · {ui.size}: {Math.round(file.size / 1024)} KB</p>
        </section>
      )}

      <section aria-label={locale === 'ar' ? 'الإعدادات' : 'Settings'} style={{ marginTop: 20, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        {fields.map(([key, label, required]) => (
          <label key={key} style={{ display: 'grid', gap: 6 }}>
            <span>{label}{required ? ' *' : ''}</span>
            <input
              inputMode="decimal"
              aria-label={label}
              value={parameters[key]}
              disabled={busy}
              onChange={(event) => setParameters((current) => ({ ...current, [key]: event.target.value }))}
            />
          </label>
        ))}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
        <button data-testid="video-run" type="button" disabled={!file || busy} onClick={() => void run()}>
          {busy ? ui.processing : ui.run}
        </button>
        <button data-testid="video-reset" type="button" disabled={busy} onClick={reset}>
          {ui.reset}
        </button>
      </div>

      {busy && <p role="status" aria-live="polite">{ui.verifying}</p>}
      {error && <p role="alert" style={{ marginTop: 12 }}>{error}</p>}

      <section aria-live="polite" aria-label={ui.result} style={{ marginTop: 24 }}>
        <h3>{ui.result}</h3>
        {result && resultUrl ? (
          <>
            <video controls preload="metadata" src={resultUrl} style={{ width: '100%', maxHeight: 420 }} />
            <p>{ui.type}: {result.type} · {ui.size}: {Math.round(result.size / 1024)} KB</p>
            <a href={resultUrl} download={outputFileName(toolId)}>{ui.download}</a>
          </>
        ) : <p>{ui.noResult}</p>}
      </section>
    </main>
  );
}

function outputFileName(toolId: VideoToolId): string {
  return `flixo-${toolId.replace(/^video-/u, '')}-output.webm`;
}
