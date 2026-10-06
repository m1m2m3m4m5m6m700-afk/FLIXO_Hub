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
  timeoutMs?: number;
}>;

export type VideoMetadata = Readonly<{
  type: string;
  size: number;
  width: number;
  height: number;
  duration: number;
}>;

export const VIDEO_MAX_INPUT_BYTES = 512 * 1024 * 1024;
export const VIDEO_MAX_OUTPUT_BYTES = 512 * 1024 * 1024;
export const VIDEO_MAX_PIXELS = 64_000_000;
export const VIDEO_MAX_DIMENSION = 8_000;
export const VIDEO_MAX_DURATION_SECONDS = 10 * 60;
export const VIDEO_DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
export const VIDEO_MAX_FPS = 120;
export const VIDEO_MAX_BITRATE = 50_000_000;
export const VIDEO_MAX_AUDIO_BITRATE = 512_000;

const SUPPORTED_VIDEO_MIME = new Set(['video/webm', 'video/mp4', 'video/ogg']);
const VIDEO_MIME_SIGNATURES: Readonly<Record<string, readonly number[]>> = Object.freeze({
  "video/webm": [0x1a, 0x45, 0xdf, 0xa3],
  "video/ogg": [0x4f, 0x67, 0x67, 0x53],
});

function bytesEqualAt(actual: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return actual.length >= offset + expected.length && expected.every((byte, index) => actual[offset + index] === byte);
}

function looksLikeMp4(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && bytesEqualAt(bytes, [0x66, 0x74, 0x79, 0x70], 4);
}

function looksLikeVideoContainer(type: string, bytes: Uint8Array): boolean {
  if (type === "video/mp4") return looksLikeMp4(bytes);
  const signature = VIDEO_MIME_SIGNATURES[type];
  return Boolean(signature && bytesEqualAt(bytes, signature));
}

export async function validateVideoInput(inputBlob: Blob): Promise<void> {
  if (inputBlob.size <= 0) throw new Error("VIDEO_INPUT_EMPTY");
  if (!Number.isInteger(inputBlob.size) || inputBlob.size > VIDEO_MAX_INPUT_BYTES) throw new Error("VIDEO_INPUT_TOO_LARGE");
  if (!SUPPORTED_VIDEO_MIME.has(inputBlob.type)) throw new Error("VIDEO_INPUT_UNSUPPORTED_MIME");
  const header = new Uint8Array(await inputBlob.slice(0, 32).arrayBuffer());
  if (!looksLikeVideoContainer(inputBlob.type, header)) throw new Error("VIDEO_INPUT_SIGNATURE_INVALID");
}

type CaptureStreamVideoElement = HTMLVideoElement & {
  captureStream?: () => MediaStream;
};

function supportedMimeType(): string {
  const ctor = globalThis.MediaRecorder as typeof MediaRecorder | undefined;
  if (!ctor) throw new Error("VIDEO_MEDIARECORDER_UNAVAILABLE");
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const supported = candidates.find((candidate) => typeof ctor.isTypeSupported !== "function" || ctor.isTypeSupported(candidate));
  if (!supported) throw new Error("VIDEO_WEBM_ENCODING_UNAVAILABLE");
  return supported;
}

function waitForEvent(target: EventTarget, type: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Video operation aborted.", "AbortError"));
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("VIDEO_MEDIA_EVENT_FAILED"));
    };
    const cleanup = () => {
      target.removeEventListener(type, onEvent);
      target.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    target.addEventListener(type, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function seek(video: HTMLVideoElement, time: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException("Video operation aborted.", "AbortError");
  video.currentTime = time;
  await waitForEvent(video, "seeked", signal);
}

export function validateVideoRenderOptions(
  metadata: Pick<VideoMetadata, "width" | "height" | "duration">,
  options: VideoRenderOptions = {},
): void {
  const { width, height, duration } = metadata;
  if (!Number.isInteger(width) || width < 1 || width > VIDEO_MAX_DIMENSION) throw new Error("VIDEO_INPUT_WIDTH_INVALID");
  if (!Number.isInteger(height) || height < 1 || height > VIDEO_MAX_DIMENSION) throw new Error("VIDEO_INPUT_HEIGHT_INVALID");
  if (width * height > VIDEO_MAX_PIXELS) throw new Error("VIDEO_INPUT_PIXELS_EXCEEDED");
  if (!Number.isFinite(duration) || duration <= 0 || duration > VIDEO_MAX_DURATION_SECONDS) throw new Error("VIDEO_DURATION_INVALID");

  const startSec = options.startSec ?? 0;
  const endSec = options.endSec ?? duration;
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) throw new Error("VIDEO_TRIM_RANGE_INVALID");
  if (startSec < 0 || endSec > duration || endSec <= startSec) throw new Error("VIDEO_TRIM_RANGE_INVALID");

  if (options.crop) {
    const { x, y, width: cropWidth, height: cropHeight } = options.crop;
    if (![x, y, cropWidth, cropHeight].every(Number.isFinite)) throw new Error("VIDEO_CROP_INVALID");
    if (![x, y, cropWidth, cropHeight].every(Number.isInteger)) throw new Error("VIDEO_CROP_INVALID");
    if (x < 0 || y < 0 || cropWidth < 1 || cropHeight < 1 || x + cropWidth > width || y + cropHeight > height) {
      throw new Error("VIDEO_CROP_BOUNDS_INVALID");
    }
  }

  const outputWidth = options.width ?? options.crop?.width ?? width;
  const outputHeight = options.height ?? options.crop?.height ?? height;
  if (!Number.isInteger(outputWidth) || !Number.isInteger(outputHeight) || outputWidth < 1 || outputHeight < 1) throw new Error("VIDEO_OUTPUT_DIMENSIONS_INVALID");
  if (outputWidth > VIDEO_MAX_DIMENSION || outputHeight > VIDEO_MAX_DIMENSION) throw new Error("VIDEO_OUTPUT_DIMENSIONS_INVALID");
  if (outputWidth * outputHeight > VIDEO_MAX_PIXELS) throw new Error("VIDEO_OUTPUT_PIXELS_EXCEEDED");

  if (options.fps !== undefined && (!Number.isFinite(options.fps) || options.fps < 1 || options.fps > VIDEO_MAX_FPS)) throw new Error("VIDEO_FPS_INVALID");
  if (options.videoBitsPerSecond !== undefined && (!Number.isInteger(options.videoBitsPerSecond) || options.videoBitsPerSecond < 1 || options.videoBitsPerSecond > VIDEO_MAX_BITRATE)) throw new Error("VIDEO_VIDEO_BITRATE_INVALID");
  if (options.audioBitsPerSecond !== undefined && (!Number.isInteger(options.audioBitsPerSecond) || options.audioBitsPerSecond < 1 || options.audioBitsPerSecond > VIDEO_MAX_AUDIO_BITRATE)) throw new Error("VIDEO_AUDIO_BITRATE_INVALID");

  const timeoutMs = options.timeoutMs ?? VIDEO_DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > VIDEO_DEFAULT_TIMEOUT_MS) throw new Error("VIDEO_TIMEOUT_INVALID");
}

async function inspectVideoElement(video: HTMLVideoElement, inputBlob: Blob, signal?: AbortSignal): Promise<VideoMetadata> {
  await waitForEvent(video, "loadedmetadata", signal);
  const metadata: VideoMetadata = Object.freeze({
    type: inputBlob.type,
    size: inputBlob.size,
    width: video.videoWidth,
    height: video.videoHeight,
    duration: video.duration,
  });
  validateVideoRenderOptions(metadata);
  return metadata;
}

export async function inspectVideoMetadata(inputBlob: Blob, signal?: AbortSignal): Promise<VideoMetadata> {
  await validateVideoInput(inputBlob);
  if (typeof document === "undefined") throw new Error("VIDEO_BROWSER_RUNTIME_REQUIRED");

  const url = URL.createObjectURL(inputBlob);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.playsInline = true;
  video.muted = true;
  video.src = url;
  try {
    return await inspectVideoElement(video, inputBlob, signal);
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

function buildCanvas(video: HTMLVideoElement, options: VideoRenderOptions): { canvas: HTMLCanvasElement; source: { x: number; y: number; width: number; height: number } } {
  const source = options.crop
    ? { x: options.crop.x, y: options.crop.y, width: options.crop.width, height: options.crop.height }
    : { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight };
  const width = options.width ?? source.width;
  const height = options.height ?? source.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, source };
}

async function stopRecorder(recorder: MediaRecorder | undefined): Promise<void> {
  if (!recorder || recorder.state === "inactive") return;
  await new Promise<void>((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      resolve();
    };
    recorder.addEventListener("stop", finish, { once: true });
    timeoutId = setTimeout(finish, 5_000);
    try {
      recorder.stop();
    } catch {
      finish();
    }
  });
}

export async function renderVideoToWebm(inputBlob: Blob, options: VideoRenderOptions = {}): Promise<Blob> {
  await validateVideoInput(inputBlob);
  if (typeof document === "undefined") throw new Error("VIDEO_BROWSER_RUNTIME_REQUIRED");
  if (typeof HTMLVideoElement === "undefined" || typeof MediaRecorder === "undefined") throw new Error("VIDEO_BROWSER_APIS_UNAVAILABLE");
  if (typeof HTMLCanvasElement === "undefined" || typeof document.createElement("canvas").captureStream !== "function") {
    throw new Error("VIDEO_CANVAS_CAPTURE_UNAVAILABLE");
  }

  const url = URL.createObjectURL(inputBlob);
  const video = document.createElement("video");
  video.preload = "auto";
  video.playsInline = true;
  video.muted = true;
  video.src = url;

  let canvasStream: MediaStream | undefined;
  let sourceStream: MediaStream | null = null;
  let recorder: MediaRecorder | undefined;
  let drawFrameId = 0;
  let tickFrameId = 0;
  let drawing = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const metadata = await inspectVideoElement(video, inputBlob, options.signal);
    validateVideoRenderOptions(metadata, options);

    const { canvas, source } = buildCanvas(video, options);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("VIDEO_CANVAS_CONTEXT_UNAVAILABLE");

    const fps = options.fps ?? 30;
    canvasStream = canvas.captureStream(fps);
    const captureVideo = video as CaptureStreamVideoElement;
    sourceStream = typeof captureVideo.captureStream === "function" ? captureVideo.captureStream() : null;
    if (sourceStream) {
      for (const track of sourceStream.getAudioTracks()) {
        try {
          canvasStream.addTrack(track);
        } catch {
          // Audio was already attached by the browser.
        }
      }
    }

    const mimeType = supportedMimeType();
    recorder = new MediaRecorder(canvasStream, {
      mimeType,
      ...(options.videoBitsPerSecond !== undefined ? { videoBitsPerSecond: options.videoBitsPerSecond } : {}),
      ...(options.audioBitsPerSecond !== undefined ? { audioBitsPerSecond: options.audioBitsPerSecond } : {}),
    });

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onCallerAbort, { once: true });
    timeoutId = setTimeout(() => {
      if (!options.signal?.aborted) controller.abort();
    }, options.timeoutMs ?? VIDEO_DEFAULT_TIMEOUT_MS);

    const chunks: Blob[] = [];
    let stopError: Error | undefined;
    let processingError: Error | undefined;
    let bufferedBytes = 0;
    recorder.ondataavailable = (event) => {
      if (event.data.size <= 0) return;
      bufferedBytes += event.data.size;
      chunks.push(event.data);
      if (bufferedBytes > VIDEO_MAX_OUTPUT_BYTES) {
        stopError = new Error("VIDEO_OUTPUT_TOO_LARGE");
        controller.abort();
      }
    };
    recorder.onerror = () => {
      stopError = new Error("VIDEO_RECORDING_FAILED");
      controller.abort();
    };

    if (options.signal?.aborted) throw new DOMException("Video operation aborted.", "AbortError");
    const startSec = options.startSec ?? 0;
    const endSec = options.endSec ?? metadata.duration;

    try {
      await seek(video, startSec, controller.signal);
      recorder.start(250);
      drawing = true;

      const draw = () => {
        if (!drawing || controller.signal.aborted) return;
        context.drawImage(video, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
        drawFrameId = requestAnimationFrame(draw);
      };
      draw();
      await video.play();

      await new Promise<void>((resolve, reject) => {
        const tick = () => {
          if (controller.signal.aborted) {
            reject(options.signal?.aborted
              ? new DOMException("Video operation aborted.", "AbortError")
              : (stopError ?? new Error("VIDEO_PROCESSING_TIMEOUT")));
            return;
          }
          if (video.currentTime >= endSec || video.ended) {
            resolve();
            return;
          }
          tickFrameId = requestAnimationFrame(tick);
        };
        tick();
      });
    } catch (error) {
      processingError = error instanceof Error ? error : new Error("VIDEO_PROCESSING_FAILED");
    } finally {
      drawing = false;
      cancelAnimationFrame(drawFrameId);
      cancelAnimationFrame(tickFrameId);
      video.pause();
      options.signal?.removeEventListener("abort", onCallerAbort);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    await stopRecorder(recorder);
    if (processingError) throw processingError;
    if (stopError) throw stopError;
    if (!chunks.length) throw new Error("VIDEO_RECORDING_EMPTY");
    const output = new Blob(chunks, { type: "video/webm" });
    if (output.size <= 0 || output.size > VIDEO_MAX_OUTPUT_BYTES || output.type !== "video/webm") throw new Error("VIDEO_OUTPUT_INVALID");
    return output;
  } finally {
    drawing = false;
    cancelAnimationFrame(drawFrameId);
    cancelAnimationFrame(tickFrameId);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // Cleanup must continue even if the recorder is already broken.
      }
    }
    canvasStream?.getTracks().forEach((track) => track.stop());
    if (sourceStream && sourceStream !== canvasStream) sourceStream.getTracks().forEach((track) => track.stop());
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
