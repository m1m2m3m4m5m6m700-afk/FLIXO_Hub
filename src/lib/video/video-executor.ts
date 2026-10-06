import { attachVideoBlobSource, getBoundedVideoDuration } from './blob-video-source.ts';
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
type CaptureStreamVideoElement = HTMLVideoElement & { captureStream?: () => MediaStream };

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
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function seek(video: HTMLVideoElement, time: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException('Video operation aborted.', 'AbortError');
  const target = Math.max(0, time);
  // A no-op seek (especially the common startSec=0 case) may not emit a seeked event.
  if (video.readyState >= 2 && Math.abs(video.currentTime - target) < 0.001) return;
  const seeked = waitForEvent(video, 'seeked', signal);
  video.currentTime = target;
  await seeked;
}

function buildCanvas(video: HTMLVideoElement, options: VideoRenderOptions): { canvas: HTMLCanvasElement; source: { x: number; y: number; width: number; height: number } } {
  const source = options.crop
    ? (() => {
      const x = Math.min(Math.max(0, options.crop!.x), Math.max(0, video.videoWidth - 1));
      const y = Math.min(Math.max(0, options.crop!.y), Math.max(0, video.videoHeight - 1));
      const maxWidth = Math.max(1, video.videoWidth - x);
      const maxHeight = Math.max(1, video.videoHeight - y);
      return {
        x,
        y,
        width: Math.min(Math.max(1, options.crop!.width), maxWidth),
        height: Math.min(Math.max(1, options.crop!.height), maxHeight),
      };
    })()
    : { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight };
  const width = Math.max(1, Math.round(options.width ?? source.width));
  const height = Math.max(1, Math.round(options.height ?? source.height));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, source };
}

export async function renderVideoToWebm(inputBlob: Blob, options: VideoRenderOptions = {}): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('VIDEO_BROWSER_RUNTIME_REQUIRED');
  if (typeof HTMLVideoElement === 'undefined' || typeof MediaRecorder === 'undefined') throw new Error('VIDEO_BROWSER_APIS_UNAVAILABLE');
  if (inputBlob.size <= 0) throw new Error('VIDEO_INPUT_EMPTY');

  const video = document.createElement('video');
  let canvasStream: MediaStream | undefined;
  let sourceStream: MediaStream | null = null;
  let recorder: MediaRecorder | undefined;
  let frameHandle = 0;
  let drawing = false;
  let releaseSource: (() => void) | null = null;
  video.preload = 'auto';
  // Processing is programmatic; mute playback so browser autoplay policy cannot block local rendering.
  // The renderer captures the processed video track into a local WebM artifact.
  video.muted = true;
  video.playsInline = true;
  // Keep the media element attached to the document so headless Chromium reliably
  // starts playback and advances decoded frames during canvas capture.
  video.style.position = 'fixed';
  video.style.left = '-10000px';
  video.style.top = '0';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  document.body?.appendChild(video);

  try {
    const metadataReady = waitForEvent(video, 'loadedmetadata');
    // Attach the Blob through the shared safe media-source adapter; no DOM object URL is created here.
    releaseSource = await attachVideoBlobSource(video, inputBlob, options.signal);
    await metadataReady;
    const duration = await getBoundedVideoDuration(video, 10 * 60, options.signal);

    const startSec = Math.max(0, Math.min(options.startSec ?? 0, Math.max(0, duration - 0.001)));
    const endSec = Math.max(startSec + 0.001, Math.min(options.endSec ?? duration, duration));
    if (endSec <= startSec) throw new Error('VIDEO_TRIM_RANGE_INVALID');

    // Compression requests are bounded relative to the source bitrate so the result
    // is not merely re-encoded at a larger or identical bitrate for tiny inputs.
    const sourceBitsPerSecond = (inputBlob.size * 8) / duration;
    const compressionBitrateTarget = options.videoBitsPerSecond !== undefined
      ? Math.max(32_000, Math.floor(sourceBitsPerSecond * 0.70))
      : undefined;
    const effectiveVideoBitsPerSecond = compressionBitrateTarget === undefined
      ? options.videoBitsPerSecond
      : Math.max(16_000, Math.min(options.videoBitsPerSecond!, Math.floor(compressionBitrateTarget * 0.80)));
    const effectiveAudioBitsPerSecond = compressionBitrateTarget === undefined
      ? options.audioBitsPerSecond
      : Math.max(8_000, Math.min(options.audioBitsPerSecond ?? 128_000, Math.floor(compressionBitrateTarget * 0.20)));

    const { canvas, source } = buildCanvas(video, options);
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
      ...(effectiveVideoBitsPerSecond ? { videoBitsPerSecond: effectiveVideoBitsPerSecond } : {}),
      ...(effectiveAudioBitsPerSecond ? { audioBitsPerSecond: effectiveAudioBitsPerSecond } : {}),
    });

    const activeRecorder = recorder;
    const chunks: Blob[] = [];
    const stopped = new Promise<void>((resolve, reject) => {
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      activeRecorder.onerror = () => reject(new Error('VIDEO_RECORDING_FAILED'));
      activeRecorder.onstop = () => resolve();
    });

    if (options.signal?.aborted) throw new DOMException('Video operation aborted.', 'AbortError');
    await seek(video, startSec, options.signal);

    drawing = true;
    const draw = () => {
      if (!drawing || options.signal?.aborted) return;
      context.drawImage(video, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
    };

    // Paint one deterministic frame before recording starts. This avoids a Chromium
    // headless race where a large resized canvas can otherwise produce no encoded
    // video chunks before the bounded recording window expires.
    draw();
    activeRecorder.start(100);
    draw();

    // requestAnimationFrame can be throttled for an off-screen processing surface.
    // Use a bounded timer-driven sampler so resizing/cropping is independent of
    // animation scheduling while remaining fully local and resource-bounded.
    const frameInterval = setInterval(draw, 33);
    // Do not block the recorder on the media element's play() promise.
    // Headless Chromium can leave that promise pending even though the element
    // has a decodable local source. The bounded recording timer remains authoritative.
    void video.play().catch(() => {
      // Playback failure is surfaced by the bounded runtime if no media is available;
      // recording itself must not deadlock on a pending play() promise.
    });

    const recordDurationMs = Math.max(1, Math.ceil((endSec - startSec) * 1000));
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
        video.removeEventListener('error', onError);
      };
      const onAbort = () => {
        cleanup();
        reject(new DOMException('Video operation aborted.', 'AbortError'));
      };
      const onError = () => {
        cleanup();
        reject(new Error('VIDEO_PLAYBACK_FAILED'));
      };
      options.signal?.addEventListener('abort', onAbort, { once: true });
      video.addEventListener('error', onError, { once: true });
      // Do not depend on media-element currentTime advancing in headless Chromium.
      // The recorder duration is bounded by the requested trim window and frame
      // sampling continues independently until that wall-clock deadline.
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, recordDurationMs);
    });

    drawing = false;
    clearInterval(frameInterval);
    cancelAnimationFrame(frameHandle);
    video.pause();
    if (activeRecorder.state !== 'inactive') {
      try { activeRecorder.requestData(); } catch { /* recorder may already be stopping */ }
      activeRecorder.stop();
    }
    await stopped;

    canvasStream.getTracks().forEach((track) => track.stop());
    sourceStream?.getTracks().forEach((track) => track.stop());

    if (!chunks.length) throw new Error('VIDEO_RECORDING_EMPTY');
    return new Blob(chunks, { type: 'video/webm' });
  } finally {
    drawing = false;
    clearInterval(frameInterval);
    if (frameHandle) cancelAnimationFrame(frameHandle);
    video.pause();
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* recorder may already be stopping */ }
    }
    canvasStream?.getTracks().forEach((track) => track.stop());
    sourceStream?.getTracks().forEach((track) => track.stop());
    // The source is detached by attachVideoBlobSource's cleanup closure.
    releaseSource?.();
    video.removeAttribute('src');
    video.load();
    if (video.parentNode) video.parentNode.removeChild(video);
  }
}
