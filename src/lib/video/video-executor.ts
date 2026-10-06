export type VideoRenderOptions = Readonly<{
  startSec?: number;
  endSec?: number;
  crop?: Readonly<{ x: number; y: number; width: number; height: number }>;
  width?: number;
  height?: number;
  fps?: number;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  signal?: AbortSignal;
}>;

type MediaRecorderConstructor = typeof MediaRecorder;
type CaptureStreamVideoElement = HTMLVideoElement & {
  captureStream?: () => MediaStream;
};

const MAX_VIDEO_RENDER_PIXELS = 64_000_000;

function supportedMimeType(): string {
  const ctor = globalThis.MediaRecorder as MediaRecorderConstructor | undefined;
  if (!ctor) throw new Error('VIDEO_MEDIARECORDER_UNAVAILABLE');
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const supported = candidates.find((candidate) => typeof ctor.isTypeSupported !== 'function' || ctor.isTypeSupported(candidate));
  if (!supported) throw new Error('VIDEO_WEBM_ENCODING_UNAVAILABLE');
  return supported;
}

function waitForEvent(target: EventTarget, type: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => { cleanup(); reject(new DOMException('Video operation aborted.', 'AbortError')); };
    const onEvent = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('VIDEO_MEDIA_EVENT_FAILED')); };
    const cleanup = () => {
      target.removeEventListener(type, onEvent);
      target.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };
    target.addEventListener(type, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function seek(video: HTMLVideoElement, time: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException('Video operation aborted.', 'AbortError');
  video.currentTime = Math.max(0, time);
  await waitForEvent(video, 'seeked', signal);
}

function buildCanvas(video: HTMLVideoElement, options: VideoRenderOptions): { canvas: HTMLCanvasElement; source: { x: number; y: number; width: number; height: number } } {
  const source = options.crop
    ? {
      x: Math.min(Math.max(0, options.crop.x), Math.max(0, video.videoWidth - 1)),
      y: Math.min(Math.max(0, options.crop.y), Math.max(0, video.videoHeight - 1)),
      width: Math.min(Math.max(1, options.crop.width), video.videoWidth),
      height: Math.min(Math.max(1, options.crop.height), video.videoHeight),
    }
    : { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight };
  if (source.width * source.height > MAX_VIDEO_RENDER_PIXELS) {
    throw new Error('VIDEO_SOURCE_TOO_LARGE');
  }
  const width = Math.max(1, Math.round(options.width ?? source.width));
  const height = Math.max(1, Math.round(options.height ?? source.height));
  if (width * height > MAX_VIDEO_RENDER_PIXELS) {
    throw new Error('VIDEO_OUTPUT_TOO_LARGE');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, source };
}

export async function renderVideoToWebm(inputBlob: Blob, options: VideoRenderOptions = {}): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('VIDEO_BROWSER_RUNTIME_REQUIRED');
  if (typeof HTMLVideoElement === 'undefined' || typeof MediaRecorder === 'undefined') throw new Error('VIDEO_BROWSER_APIS_UNAVAILABLE');
  if (inputBlob.size <= 0) throw new Error('VIDEO_INPUT_EMPTY');

  const url = URL.createObjectURL(inputBlob);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = false;
  video.playsInline = true;
  video.src = url;

  let canvas: HTMLCanvasElement | undefined;
  let canvasStream: MediaStream | undefined;
  let sourceStream: MediaStream | null = null;
  let recorder: MediaRecorder | undefined;
  let stopped: Promise<void> | undefined;
  let frameHandle = 0;
  let drawing = false;

  try {
    await waitForEvent(video, 'loadedmetadata', options.signal);
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('VIDEO_METADATA_INVALID');

    const startSec = Math.max(0, Math.min(options.startSec ?? 0, Math.max(0, duration - 0.001)));
    const endSec = Math.max(startSec + 0.001, Math.min(options.endSec ?? duration, duration));
    if (endSec <= startSec) throw new Error('VIDEO_TRIM_RANGE_INVALID');

    const built = buildCanvas(video, options);
    canvas = built.canvas;
    const { source } = built;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('VIDEO_CANVAS_CONTEXT_UNAVAILABLE');

    const fps = Math.max(1, Math.min(120, Number(options.fps ?? 30)));
    canvasStream = canvas.captureStream(fps);
    const captureVideo = video as CaptureStreamVideoElement;
    sourceStream = typeof captureVideo.captureStream === 'function' ? captureVideo.captureStream() : null;
    if (sourceStream) {
      for (const track of sourceStream.getAudioTracks()) {
        try { canvasStream.addTrack(track); } catch { /* track is already attached */ }
      }
    }

    const mimeType = supportedMimeType();
    recorder = new MediaRecorder(canvasStream, {
      mimeType,
      ...(options.videoBitsPerSecond ? { videoBitsPerSecond: options.videoBitsPerSecond } : {}),
      ...(options.audioBitsPerSecond ? { audioBitsPerSecond: options.audioBitsPerSecond } : {}),
    });

    const chunks: Blob[] = [];
    stopped = new Promise<void>((resolve, reject) => {
      recorder!.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder!.onerror = () => reject(new Error('VIDEO_RECORDING_FAILED'));
      recorder!.onstop = () => resolve();
    });

    await seek(video, startSec, options.signal);

    drawing = true;
    const draw = () => {
      if (!drawing || options.signal?.aborted) return;
      context.drawImage(video, source.x, source.y, source.width, source.height, 0, 0, canvas!.width, canvas!.height);
      frameHandle = requestAnimationFrame(draw);
    };

    recorder.start(250);
    draw();
    await video.play();

    await new Promise<void>((resolve, reject) => {
      const onAbort = () => { cleanup(); reject(new DOMException('Video operation aborted.', 'AbortError')); };
      const onError = () => { cleanup(); reject(new Error('VIDEO_PLAYBACK_FAILED')); };
      const cleanup = () => {
        options.signal?.removeEventListener('abort', onAbort);
        video.removeEventListener('error', onError);
      };
      options.signal?.addEventListener('abort', onAbort, { once: true });
      video.addEventListener('error', onError, { once: true });
      const tick = () => {
        if (options.signal?.aborted) {
          onAbort();
          return;
        }
        if (video.currentTime >= endSec || video.ended) {
          cleanup();
          resolve();
          return;
        }
        frameHandle = requestAnimationFrame(tick);
      };
      tick();
    });

    drawing = false;
    cancelAnimationFrame(frameHandle);
    video.pause();
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;

    if (!chunks.length) throw new Error('VIDEO_RECORDING_EMPTY');
    return new Blob(chunks, { type: 'video/webm' });
  } finally {
    drawing = false;
    cancelAnimationFrame(frameHandle);
    video.pause();
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* recorder may already be stopping */ }
    }
    await stopped?.catch(() => undefined);
    canvasStream?.getTracks().forEach((track) => track.stop());
    sourceStream?.getTracks().forEach((track) => track.stop());
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
