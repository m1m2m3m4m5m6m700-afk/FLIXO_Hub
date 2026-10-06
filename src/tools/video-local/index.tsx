import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { executeCanonicalTool } from '@/lib/execution/canonical-executor';
import type { CanonicalCapabilityParameters } from '@/config/manual-capability-definition';

type VideoFormState = {
  startSec: string;
  endSec: string;
  x: string;
  y: string;
  cropWidth: string;
  cropHeight: string;
  width: string;
  height: string;
  fps: string;
  videoBitsPerSecond: string;
  audioBitsPerSecond: string;
};

const DEFAULTS: VideoFormState = {
  startSec: '0',
  endSec: '0.5',
  x: '64',
  y: '48',
  cropWidth: '64',
  cropHeight: '64',
  width: '160',
  height: '90',
  fps: '15',
  videoBitsPerSecond: '200000',
  audioBitsPerSecond: '64000',
};

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function VideoLocalTool() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<VideoFormState>(DEFAULTS);
  const controllerRef = useRef<AbortController | null>(null);
  const location = useLocation();
  const id = String(location.pathname).split('/').pop() ?? 'video-trimmer';

  const update = (key: keyof VideoFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const clearResult = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setResult(null);
  };

  const reset = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    clearResult();
    setFile(null);
    setError('');
    setBusy(false);
    setForm(DEFAULTS);
  };

  const run = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    clearResult();

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      let parameters: CanonicalCapabilityParameters;
      switch (id) {
        case 'video-trimmer':
          parameters = {
            startSec: toNumber(form.startSec, 0),
            endSec: toNumber(form.endSec, 0.5),
          };
          break;
        case 'video-cropper':
          parameters = {
            x: toNumber(form.x, 64),
            y: toNumber(form.y, 48),
            width: toNumber(form.cropWidth, 64),
            height: toNumber(form.cropHeight, 64),
          };
          break;
        case 'video-resizer':
          parameters = {
            width: toNumber(form.width, 160),
            height: toNumber(form.height, 90),
            fps: toNumber(form.fps, 15),
          };
          break;
        case 'video-compressor':
          parameters = {
            videoBitsPerSecond: toNumber(form.videoBitsPerSecond, 200_000),
            audioBitsPerSecond: toNumber(form.audioBitsPerSecond, 64_000),
          };
          break;
        default:
          throw new Error('Execution denied: unknown video tool.');
      }

      const output = await executeCanonicalTool(id,
        { blob: file, fileName: file.name },
        parameters,
        controller.signal,
      );
      controller.signal.throwIfAborted?.();
      const url = URL.createObjectURL(output.blob);
      setResult(output.blob);
      setResultUrl(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Video processing failed.');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setBusy(false);
    }
  };

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const showTrim = id === 'video-trimmer';
  const showCrop = id === 'video-cropper';
  const showResize = id === 'video-resizer';
  const showCompress = id === 'video-compressor';

  return (
    <section aria-label="Local video processing" style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h2>Local video processing</h2>
      <p>Local browser video execution. The original file is not modified or uploaded.</p>

      <input
        aria-label="Choose video"
        type="file"
        accept="video/*"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setError('');
          clearResult();
        }}
      />

      {showTrim && (
        <fieldset>
          <legend>Trim</legend>
          <label>
            Start (seconds)
            <input aria-label="Start (seconds)" type="number" min="0" step="0.1" value={form.startSec} onChange={(e) => update('startSec', e.target.value)} />
          </label>
          <label>
            End (seconds)
            <input aria-label="End (seconds)" type="number" min="0.1" step="0.1" value={form.endSec} onChange={(e) => update('endSec', e.target.value)} />
          </label>
        </fieldset>
      )}

      {showCrop && (
        <fieldset>
          <legend>Crop</legend>
          <label>
            Crop X
            <input aria-label="Crop X" type="number" min="0" step="1" value={form.x} onChange={(e) => update('x', e.target.value)} />
          </label>
          <label>
            Crop Y
            <input aria-label="Crop Y" type="number" min="0" step="1" value={form.y} onChange={(e) => update('y', e.target.value)} />
          </label>
          <label>
            Width
            <input aria-label="Width" type="number" min="1" step="1" value={form.cropWidth} onChange={(e) => update('cropWidth', e.target.value)} />
          </label>
          <label>
            Height
            <input aria-label="Height" type="number" min="1" step="1" value={form.cropHeight} onChange={(e) => update('cropHeight', e.target.value)} />
          </label>
        </fieldset>
      )}

      {showResize && (
        <fieldset>
          <legend>Resize</legend>
          <label>
            Width
            <input aria-label="Width" type="number" min="1" step="1" value={form.width} onChange={(e) => update('width', e.target.value)} />
          </label>
          <label>
            Height
            <input aria-label="Height" type="number" min="1" step="1" value={form.height} onChange={(e) => update('height', e.target.value)} />
          </label>
          <label>
            FPS
            <input aria-label="FPS" type="number" min="1" max="120" step="1" value={form.fps} onChange={(e) => update('fps', e.target.value)} />
          </label>
        </fieldset>
      )}

      {showCompress && (
        <fieldset>
          <legend>Compression</legend>
          <label>
            Video bitrate
            <input aria-label="Video bitrate" type="number" min="100000" max="50000000" step="1000" value={form.videoBitsPerSecond} onChange={(e) => update('videoBitsPerSecond', e.target.value)} />
          </label>
          <label>
            Audio bitrate
            <input aria-label="Audio bitrate" type="number" min="8000" max="512000" step="1000" value={form.audioBitsPerSecond} onChange={(e) => update('audioBitsPerSecond', e.target.value)} />
          </label>
        </fieldset>
      )}

      <div>
        <button type="button" disabled={!file || busy} onClick={() => void run()}>{busy ? 'Processing…' : 'Process video'}</button>
        {busy && <button type="button" onClick={() => controllerRef.current?.abort()}>Cancel</button>}
        {(file || result || error) && !busy && <button type="button" onClick={reset}>Reset</button>}
      </div>

      {error && <p role="alert">Video processing failed: {error}</p>}
      {result && resultUrl && <a download="flixo-video-output.webm" href={resultUrl}>Download result</a>}
    </section>
  );
};
