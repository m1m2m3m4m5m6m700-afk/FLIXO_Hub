import { useEffect, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { renderVideoToWebm } from '@/lib/video/video-executor';

async function readVideoMetadata(file: File): Promise<{ width: number; height: number; duration: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not read video metadata.'));
    });
    if (video.videoWidth < 1 || video.videoHeight < 1 || !Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error('Video metadata is invalid.');
    }
    return { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}

export function VideoLocalTool() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const id = String(location.pathname).split('/').pop() ?? 'video-trimmer';

  useEffect(() => () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  const run = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl('');
    try {
      const metadata = await readVideoMetadata(file);
      const width = Math.min(1280, metadata.width);
      const height = Math.min(720, metadata.height);
      const cropWidth = Math.max(1, Math.min(1280, metadata.width));
      const cropHeight = Math.max(1, Math.min(720, metadata.height));
      const output = await renderVideoToWebm(
        file,
        id === 'video-trimmer'
          ? {}
          : id === 'video-compressor'
            ? { videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 }
            : id === 'video-resizer'
              ? { width, height }
              : { crop: { x: 0, y: 0, width: cropWidth, height: cropHeight } },
      );
      if (id === 'video-compressor' && output.size >= file.size) {
        throw new Error('Video compression did not reduce the file size.');
      }
      const url = URL.createObjectURL(output);
      setResult(output);
      setResultUrl(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Video processing failed.');
    } finally {
      setBusy(false);
    }
  };

  return <section aria-label="Local video processing" style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
    <h2>Local video processing</h2>
    <p>Local browser video execution. The original file is not modified.</p>
    <input aria-label="Choose video" type="file" accept="video/*" onChange={(event) => {
      setFile(event.target.files?.[0] ?? null);
      setError('');
      setResult(null);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl('');
    }} />
    <button type="button" disabled={!file || busy} onClick={() => void run()}>{busy ? 'Processing…' : 'Process video'}</button>
    {error && <p role="alert">{error}</p>}
    {result && <a download="flixo-video-output.webm" href={resultUrl}>Download result</a>}
  </section>;
}
