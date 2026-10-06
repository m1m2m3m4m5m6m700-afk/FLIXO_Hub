import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { executeCanonicalTool } from '@/lib/execution/canonical-executor';
import type { CanonicalCapabilityParameters } from '@/config/manual-capability-definition';

export function VideoLocalTool() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abortController = useRef<AbortController | null>(null);
  const location = useLocation();
  const id = String(location.pathname).split('/').pop() ?? 'video-trimmer';

  useEffect(() => {
    return () => {
      abortController.current?.abort();
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const run = async () => {
    if (!file) return;
    const controller = new AbortController();
    abortController.current = controller;
    setBusy(true);
    setError('');
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }
    setResult(null);
    try {
      const parameters: CanonicalCapabilityParameters = id === 'video-trimmer'
        ? { startSec: 0, endSec: 1 }
        : id === 'video-compressor'
          ? { videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 }
          : id === 'video-resizer'
            ? { width: 1280, height: 720 }
            : { x: 40, y: 20, width: 160, height: 90 };
      const output = await executeCanonicalTool(id, { blob: file, fileName: file.name }, parameters, controller.signal);
      const url = URL.createObjectURL(output.blob);
      setResult(output.blob);
      setResultUrl(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Video processing failed.');
    } finally {
      if (abortController.current === controller) abortController.current = null;
      setBusy(false);
    }
  };

  const cancel = () => abortController.current?.abort();

  return <section aria-label="Local video processing" style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
    <h2>Local video processing</h2>
    <p>Local browser video execution. The original file is not modified.</p>
    <input aria-label="Choose video" type="file" accept="video/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
    <button type="button" disabled={!file || busy} onClick={() => void run()}>{busy ? 'Processing…' : 'Process video'}</button>
    {busy && <button type="button" onClick={cancel}>Cancel</button>}
    {error && <p role="alert">Video processing failed: {error}</p>}
    {result && resultUrl && <a download="flixo-video-output.webm" href={resultUrl}>Download result</a>}
  </section>;
}