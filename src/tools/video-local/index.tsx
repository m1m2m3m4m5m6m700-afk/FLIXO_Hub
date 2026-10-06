import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { renderVideoToWebm } from '@/lib/video/video-executor';

export function VideoLocalTool() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const resultUrlRef = useRef('');
  const runAbortRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const id = String(location.pathname).split('/').pop() ?? 'video-trimmer';

  useEffect(() => () => {
    runAbortRef.current?.abort();
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = '';
  }, []);

  const replaceResult = (blob: Blob | null) => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    const next = blob ? URL.createObjectURL(blob) : '';
    resultUrlRef.current = next;
    setResult(blob);
    setResultUrl(next);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    runAbortRef.current?.abort();
    const controller = new AbortController();
    runAbortRef.current = controller;
    try {
      const output = await renderVideoToWebm(file, id === 'video-trimmer'
        ? { signal: controller.signal }
        : id === 'video-compressor'
          ? { videoBitsPerSecond: 2_500_000, signal: controller.signal }
          : id === 'video-resizer'
            ? { width: 1280, height: 720, signal: controller.signal }
            : { crop: { x: 0, y: 0, width: 1280, height: 720 }, signal: controller.signal });
      replaceResult(output);
    } finally {
      if (runAbortRef.current === controller) runAbortRef.current = null;
      setBusy(false);
    }
  };

  return <section aria-label="Local video processing" style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
    <h2>Local video processing</h2>
    <p>Local browser video execution. The original file is not modified.</p>
    <input aria-label="Choose video" type="file" accept="video/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
    <button type="button" disabled={!file || busy} onClick={() => void run()}>{busy ? 'Processing…' : 'Process video'}</button>
    {result && resultUrl && <a download="flixo-video-output.webm" href={resultUrl}>Download result</a>}
  </section>;
}
