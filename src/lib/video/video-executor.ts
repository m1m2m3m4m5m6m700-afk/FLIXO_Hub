import { assertSafeVideoInput, validateVideoRenderOptions, VIDEO_LIMITS } from './video-safety';

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
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Video operation aborted.', 'AbortError'));
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('VIDEO_MEDIA_EVENT_FAILED'));
    };
    const cleanup = () => {
      target.removeEventListener(type, onEvent);
      target.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };
    target.addEventListener(type, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function seek(video: HTMLVideoElement, time: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException('Video operation aborted.', 'AbortError');
  video.currentTime = time;
  await waitForEvent(video, 'seeked', signal);
}

function buildCanvas(
  video: HTMLVideoElement,
  options: VideoRenderOptions,
): { canvas: HTMLCanvasElement; source: { x: number; y: number; width: number; height: number } } {
  const source = options.crop
    ? { ...options.crop }
    : { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight };
  const width = Math.round(options.width ?? source.width);
  const height = Math.round(options.height ?? source.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, source };
}

function stopTracks(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* cleanup is best effort */ }
  });
}

async function stopRecorder(recorder: MediaRecorder | null): Promise<void> {
  if (!recorder || recorder.state === 'inactive') return;
  await new Promise<void>((resolve) => {
    recorder.addEventListener('stop', () => resolve(), { once: true });
    try {
      recorder.stop();
    } catch {
      resolve();
    }
  });
}

async function assertWebmArtifact(blob: Blob): Promise<void> {
  if (blob.type !== 'video/webm') throw new Error(`Unexpected video output MIME type: ${blob.type || '(missing MIME)'}`);
  if (blob.size < 4) throw new Error('VIDEO_OUTPUT_EMPTY');
  const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (header[0] !== 0x1a || header[1] !== 0x45 || header[2] !== 0xdf || header[3] !== 0xa3) {
    throw new Error('VIDEO_OUTPUT_SIGNATURE_INVALID');
  }
}

export async function renderVideoToWebm(
  inputBlob: Blob,
  options: VideoRenderOptions = {},
): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('VIDEO_BROWSER_RUNTIME_REQUIRED');
  if (typeof HTMLVideoElement === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('VIDEO_BROWSER_APIS_UNAVAILABLE');
  }

  await assertSafeVideoInput(inputBlob);
  if (options.signal?.aborted) throw new DOMException('Video operation aborted.', 'AbortError');

  const operationController = new AbortController();
  const abortFromCaller = () => operationController.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = globalThis.setTimeout(() => operationController.abort(), VIDEO_LIMITS.timeoutMs);

  const url = URL.createObjectURL(inputBlob);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  video.src = url;

  let canvasStream: MediaStream | null = null;
  let sourceStream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let frameHandle = 0;
  let drawing = false;
  const chunks: Blob[] = [];
  let totalBytes = 0;
  let recorderStopRequested = false;

  try {
    await waitForEvent(video, 'loadedmetadata', operationController.signal);
    const duration = video.duration;
    validateVideoRenderOptions({
      durationSec: duration,
      startSec: options.startSec,
      endSec: options.endSec,
      crop: options.crop,
      width: options.width,
      height: options.height,
      fps: options.fps,
      videoBitsPerSecond: options.videoBitsPerSecond,
      audioBitsPerSecond: options.audioBitsPerSecond,
      sourceWidth: video.videoWidth,
      sourceHeight: video.videoHeight,
    });

    const { canvas, source } = buildCanvas(video, options);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('VIDEO_CANVAS_CONTEXT_UNAVAILABLE');

    const fps = options.fps ?? 30;
    if (typeof canvas.captureStream !== 'function') throw new Error('VIDEO_CANVAS_CAPTURE_UNAVAILABLE');
    canvasStream = canvas.captureStream(fps);
    const captureVideo = video as CaptureStreamVideoElement;
    if (typeof captureVideo.captureStream === 'function') {
      sourceStream = captureVideo.captureStream();
      for (const track of sourceStream.getAudioTracks()) {
        try { canvasStream.addTrack(track); } catch { /* duplicate/unsupported track */ }
      }
    }

    const mimeType = supportedMimeType();
    recorder = new MediaRecorder(canvasStream, {
      mimeType,
      ...(options.videoBitsPerSecond !== undefined ? { videoBitsPerSecond: options.videoBitsPerSecond } : {}),
      ...(options.audioBitsPerSecond !== undefined ? { audioBitsPerSecond: options.audioBitsPerSecond } : {}),
    });

    let recorderFailure: Error | undefined;
    const stopped = new Promise<void>((resolve) => {
      recorder!.ondataavailable = (event) => {
        if (event.data.size <= 0) return;
        totalBytes += event.data.size;
        if (totalBytes > VIDEO_LIMITS.maxOutputBytes) {
          recorderFailure = new Error('VIDEO_OUTPUT_TOO_LARGE');
          if (!recorderStopRequested && recorder!.state !== 'inactive') {
            recorderStopRequested = true;
            recorder!.stop();
          }
          return;
        }
        chunks.push(event.data);
      };
      recorder!.onerror = () => {
        recorderFailure = recorderFailure ?? new Error('VIDEO_RECORDING_FAILED');
        operationController.abort();
      };
      recorder!.onstop = () => resolve();
    });

    await seek(video, options.startSec ?? 0, operationController.signal);

    const endSec = options.endSec ?? duration;
    drawing = true;
    const draw = () => {
      if (!drawing || operationController.signal.aborted) return;
      context.drawImage(video, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
      frameHandle = requestAnimationFrame(draw);
    };

    recorder.start(250);
    draw();
    await video.play();

    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        operationController.signal.removeEventListener('abort', onAbort);
        reject(new DOMException('Video operation aborted.', 'AbortError'));
      };
      const tick = () => {
        if (operationController.signal.aborted) {
          onAbort();
          return;
        }
        if (video.currentTime >= endSec || video.ended) {
          operationController.signal.removeEventListener('abort', onAbort);
          resolve();
          return;
        }
        frameHandle = requestAnimationFrame(tick);
      };
      operationController.signal.addEventListener('abort', onAbort, { once: true });
      tick();
    });

    drawing = false;
    cancelAnimationFrame(frameHandle);
    video.pause();
    await stopRecorder(recorder);
    await stopped;
    if (recorderFailure) throw recorderFailure;
    if (!chunks.length) throw new Error('VIDEO_RECORDING_EMPTY');

    const output = new Blob(chunks, { type: 'video/webm' });
    await assertWebmArtifact(output);
    return output;
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromCaller);
    drawing = false;
    if (frameHandle) cancelAnimationFrame(frameHandle);
    try { video.pause(); } catch { /* noop */ }
    await stopRecorder(recorder);
    stopTracks(canvasStream);
    stopTracks(sourceStream);
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
