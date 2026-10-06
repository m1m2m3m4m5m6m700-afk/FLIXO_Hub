import { useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { executeCanonicalTool } from '@/lib/execution/canonical-executor';
import type { CanonicalCapabilityParameters } from '@/config/manual-capability-definition';

export function VideoLocalTool() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const id = String(location.pathname).split('/').pop() ?? 'video-trimmer';

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const parameters: CanonicalCapabilityParameters = id === 'video-trimmer'
        ? {}
        : id === 'video-compressor'
          ? { videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 }
          : id === 'video-resizer'
            ? { width: 1280, height: 720 }
            : { x: 0, y: 0, width: 1280, height: 720 };
      const output = await executeCanonicalTool(id, { blob: file, fileName: file.name }, parameters);
      setResult(output.blob);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Video processing failed.');
    } finally {
      setBusy(false);
    }
  };

  return <section aria-label="Local video processing" style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
    <h2>Local video processing</h2>
    <p>Local browser video execution. The original file is not modified.</p>
    <input aria-label="Choose video" type="file" accept="video/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
    <button type="button" disabled={!file || busy} onClick={() => void run()}>{busy ? 'Processing…' : 'Process video'}</button>
    {error && <p role="alert">Video processing failed: {error}</p>}
    {result && <a download="flixo-video-output.webm" href={URL.createObjectURL(result)}>Download result</a>}
  </section>;
}
