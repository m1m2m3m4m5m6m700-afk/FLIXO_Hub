import { getCapability, validateCapabilityParameters, type CanonicalCapabilityParameters } from '@/config/manual-capability-definition.ts';
import { getToolById } from '@/config/registry.ts';
import { getToolOutputContract } from '@/lib/contracts/tool-output-contracts.ts';
import { assertToolOutputContract } from '@/lib/contracts/tool-output.ts';
import { validateFileSafety, MAGIC_BYTE_SIGNATURES } from '@/lib/contracts/file-safety.ts';
import { applyBasicImageEffect, convertImage, cropResizeImage, removeBackground, resizeImage } from '@/tools/image-toolkit/engine.ts';
import { compressImage } from '@/tools/image-compressor/engine.ts';
import { renderVideoToWebm } from '@/lib/video/video-executor.ts';
import { attachVideoBlobSource } from '@/lib/video/blob-video-source.ts';

const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;
const VIDEO_MIME = ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/ogg'] as const;
const VIDEO_EXTENSIONS = ['webm', 'mp4', 'mov', 'mkv', 'ogv'] as const;
const MAX_VIDEO_DURATION_SECONDS = 10 * 60;

export type CanonicalExecutionInput = Readonly<{ blob: Blob; fileName: string }>;
export type CanonicalExecutionOutput = Readonly<{ blob: Blob; fileName: string }>;

function cancelledError(): Error {
  return typeof DOMException === 'function'
    ? new DOMException('Canonical execution cancelled.', 'AbortError')
    : new Error('Canonical execution cancelled.');
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw cancelledError();
}

async function withDeadline<T>(operation: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  assertNotAborted(signal);
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new Error('Canonical execution timed out.'))), Math.max(1, timeoutMs));
    const onAbort = () => finish(() => reject(cancelledError()));
    signal?.addEventListener('abort', onAbort, { once: true });
    operation.then((value) => finish(() => resolve(value)), (error) => finish(() => reject(error)));
  });
}

async function readImageDimensions(blob: Blob, signal?: AbortSignal): Promise<{ width: number; height: number }> {
  assertNotAborted(signal);
  if (typeof createImageBitmap !== 'function') throw new Error('Browser image decoder is unavailable.');
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

async function preflightInput(
  toolId: string,
  input: CanonicalExecutionInput,
  maxBytes: number,
  maxPixels: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  assertNotAborted(signal);
  const tool = getToolById(toolId);
  if (!tool) throw new Error('Execution denied: unknown canonical tool.');
  if (input.blob.size <= 0 || input.blob.size > maxBytes) {
    throw new Error('Execution denied: input exceeds the canonical file-size boundary.');
  }

  const isVideo = tool.family === 'video';
  const allowedMime = isVideo ? VIDEO_MIME : IMAGE_MIME;
  const allowedExtensions = isVideo ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
  // The safety boundary validates the full Blob size separately above. The content passed here is only a
  // bounded signature probe, so its declared byte count must describe the probe rather than the whole Blob.
  const contentPrefix = new Uint8Array(await input.blob.slice(0, 64).arrayBuffer());
  const contentProbeBytes = contentPrefix.byteLength;
  const videoMagicBytes = input.blob.type === 'video/webm' || input.blob.type === 'video/x-matroska'
    ? [{ name: 'EBML', bytes: [0x1a, 0x45, 0xdf, 0xa3] }]
    : input.blob.type === 'video/mp4' || input.blob.type === 'video/quicktime'
      ? [{ name: 'ISO Base Media File Format', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }]
      : input.blob.type === 'video/ogg'
        ? [{ name: 'Ogg', bytes: [0x4f, 0x67, 0x67, 0x53] }]
        : [];
  const safety = validateFileSafety(
    {
      name: input.fileName,
      mime: input.blob.type,
      bytes: contentProbeBytes,
      content: contentPrefix,
    },
    {
      allowedMime,
      allowedExtensions,
      maxBytes,
      magicBytes: isVideo
        ? videoMagicBytes
        : [MAGIC_BYTE_SIGNATURES.png, MAGIC_BYTE_SIGNATURES.jpeg, MAGIC_BYTE_SIGNATURES.webp],
    },
  );
  if (!safety.safe) {
    throw new Error('Execution denied by file-safety boundary: ' + safety.failures.join('; '));
  }

  if (!isVideo) {
    const dimensions = await withDeadline(readImageDimensions(input.blob, signal), Math.min(timeoutMs, 30_000), signal);
    if (dimensions.width * dimensions.height > maxPixels) {
      throw new Error('Execution denied: image dimensions exceed the canonical pixel budget.');
    }
    return;
  }

  if (typeof document === 'undefined') throw new Error('VIDEO_BROWSER_RUNTIME_REQUIRED');
  const video = document.createElement('video');
  let releaseSource: (() => void) | null = null;
  video.preload = 'metadata';
  try {
    const metadataReady = new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('VIDEO_METADATA_INVALID'));
    });
    // Blob-backed media stays in the browser without converting untrusted data into a DOM URL.
    releaseSource = await attachVideoBlobSource(video, input.blob, signal);
    await withDeadline(
      metadataReady,
      Math.min(timeoutMs, 30_000),
      signal,
    );
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > MAX_VIDEO_DURATION_SECONDS) {
      throw new Error('Execution denied: video duration exceeds the canonical 10-minute boundary.');
    }
    if (!Number.isInteger(video.videoWidth) || !Number.isInteger(video.videoHeight) || video.videoWidth < 1 || video.videoHeight < 1) {
      throw new Error('Execution denied: video dimensions are invalid.');
    }
    if (video.videoWidth * video.videoHeight > maxPixels) {
      throw new Error('Execution denied: video dimensions exceed the canonical pixel budget.');
    }
  } finally {
    releaseSource?.();
    video.removeAttribute('src');
    video.load();
  }
}

function extensionForMime(mime: string): string {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  return 'bin';
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/u, '') || 'flixo-output';
}

function numberOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function executeImageEffectsInWorker(
  input: Blob,
  effects: ReadonlyArray<readonly ['brightness' | 'contrast' | 'saturation' | 'grayscale', number]>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Blob> {
  if (typeof Worker === 'undefined') {
    return executeImageEffectsFallback(input, effects);
  }

  const worker = new Worker(new URL('./image-effects.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<Blob>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error('Image effects worker timed out.'))),
      Math.max(1, Math.min(timeoutMs, 30_000)),
    );
    const onAbort = () => finish(() => reject(cancelledError()));
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.onerror = () => finish(() => reject(new Error('IMAGE_EFFECTS_WORKER_FAILED')));
    worker.onmessage = (event: MessageEvent<{ ok: boolean; blob?: Blob; error?: string }>) => {
      const data = event.data;
      if (data?.ok && data.blob instanceof Blob && data.blob.size > 0) {
        finish(() => resolve(data.blob!));
        return;
      }
      finish(() => reject(new Error(data?.error || 'IMAGE_EFFECTS_WORKER_FAILED')));
    };
    try {
      worker.postMessage({ blob: input, effects });
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new Error('IMAGE_EFFECTS_WORKER_FAILED')));
    }
  });
}

async function executeImageEffectsFallback(
  input: Blob,
  effects: ReadonlyArray<readonly ['brightness' | 'contrast' | 'saturation' | 'grayscale', number]>,
): Promise<Blob> {
  let current = input;
  for (const [effect, value] of effects) {
    current = await applyBasicImageEffect(current, effect, value);
  }
  return current;
}

async function executeImageEffects(
  input: Blob,
  parameters: CanonicalCapabilityParameters,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const effects: Array<['brightness' | 'contrast' | 'saturation' | 'grayscale', number]> = [];
  for (const key of ['brightness', 'contrast', 'saturate', 'grayscale'] as const) {
    const value = parameters[key];
    if (typeof value !== 'number') continue;
    const neutral = key === 'grayscale' ? 0 : 100;
    if (value === neutral) continue;
    const effect = key === 'saturate' ? 'saturation' : key;
    effects.push([effect, value]);
  }
  if (!effects.length) throw new Error('Image effects require at least one non-neutral adjustment.');
  return executeImageEffectsInWorker(input, effects, timeoutMs, signal);
}

async function executeMvpTool(
  toolId: string,
  input: CanonicalExecutionInput,
  parameters: CanonicalCapabilityParameters,
  signal?: AbortSignal,
): Promise<CanonicalExecutionOutput> {
  assertNotAborted(signal);
  if (toolId.startsWith('video-')) {
    const options =
      toolId === 'video-trimmer'
        ? {
            startSec: numberOr(parameters.startSec, 0),
            endSec: parameters.endSec === undefined ? undefined : numberOr(parameters.endSec, 0),
            signal,
          }
        : toolId === 'video-cropper'
          ? {
              crop: {
                x: Math.max(0, Math.floor(numberOr(parameters.x, 0))),
                y: Math.max(0, Math.floor(numberOr(parameters.y, 0))),
                width: Math.max(1, Math.floor(numberOr(parameters.width, 1))),
                height: Math.max(1, Math.floor(numberOr(parameters.height, 1))),
              },
              signal,
            }
          : toolId === 'video-resizer'
            ? {
                width: Math.max(1, Math.floor(numberOr(parameters.width, 1))),
                height: Math.max(1, Math.floor(numberOr(parameters.height, 1))),
                fps: numberOr(parameters.fps, 30),
                signal,
              }
            : {
                videoBitsPerSecond: Math.floor(numberOr(parameters.videoBitsPerSecond, 2_500_000)),
                audioBitsPerSecond: Math.floor(numberOr(parameters.audioBitsPerSecond, 128_000)),
                signal,
              };
    const blob = await renderVideoToWebm(input.blob, options);
    return Object.freeze({ blob, fileName: baseName(input.fileName) + '-output.webm' });
  }

  switch (toolId) {
    case 'background-remover': {
      const blob = await removeBackground(input.blob, numberOr(parameters.tolerance, 42));
      return Object.freeze({ blob, fileName: baseName(input.fileName) + '-no-background.png' });
    }
    case 'image-upscaler': {
      const scale = numberOr(parameters.scale, 2);
      const blob = await resizeImage(input.blob, scale);
      return Object.freeze({ blob, fileName: baseName(input.fileName) + '-' + scale + 'x.png' });
    }
    case 'image-cropper': {
      const source = await readImageDimensions(input.blob, signal);
      const x = numberOr(parameters.x, 0);
      const y = numberOr(parameters.y, 0);
      const cropWidth = numberOr(parameters.cropWidth, source.width);
      const cropHeight = numberOr(parameters.cropHeight, source.height);
      let width = numberOr(parameters.width, cropWidth);
      let height = numberOr(parameters.height, cropHeight);
      if (typeof parameters.aspectRatio === 'string') {
        const [ratioWidth, ratioHeight] = parameters.aspectRatio.split(':').map(Number);
        if (ratioWidth > 0 && ratioHeight > 0) {
          const ratio = ratioWidth / ratioHeight;
          if (source.width / source.height > ratio) {
            const centeredWidth = Math.max(1, Math.round(source.height * ratio));
            width = centeredWidth;
            height = source.height;
          } else {
            width = source.width;
            height = Math.max(1, Math.round(source.width / ratio));
          }
        }
      }
      const blob = await cropResizeImage(
        input.blob,
        { x, y, width: cropWidth, height: cropHeight },
        { width, height },
      );
      return Object.freeze({ blob, fileName: baseName(input.fileName) + '-cropped.png' });
    }
    case 'image-compressor': {
      const format = typeof parameters.format === 'string' ? parameters.format : 'image/webp';
      const result = await compressImage(new File([input.blob], input.fileName, { type: input.blob.type }), {
        quality: numberOr(parameters.quality, 0.82),
        format: format as 'image/png' | 'image/jpeg' | 'image/webp',
        targetSizeKB: typeof parameters.targetSizeKB === 'number' ? parameters.targetSizeKB : undefined,
        maxWidth: typeof parameters.maxWidth === 'number' ? parameters.maxWidth : undefined,
        maxHeight: typeof parameters.maxHeight === 'number' ? parameters.maxHeight : undefined,
      });
      return Object.freeze({ blob: result.blob, fileName: baseName(input.fileName) + '-compressed.' + extensionForMime(result.mimeType) });
    }
    case 'image-converter': {
      const format = parameters.format;
      if (typeof format !== 'string' || !IMAGE_MIME.includes(format as (typeof IMAGE_MIME)[number])) {
        throw new Error('Execution denied: image-converter format is not admitted.');
      }
      const blob = await convertImage(input.blob, format as (typeof IMAGE_MIME)[number]);
      return Object.freeze({ blob, fileName: baseName(input.fileName) + '.' + extensionForMime(format) });
    }
    case 'image-effects': {
      const blob = await executeImageEffects(input.blob, parameters, 30_000, signal);
      return Object.freeze({ blob, fileName: baseName(input.fileName) + '-effects.png' });
    }
    default:
      throw new Error('Execution denied: no canonical executor is registered for ' + toolId + '.');
  }
}

async function verifyOutputContract(
  toolId: string,
  output: CanonicalExecutionOutput,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  const contract = getToolOutputContract(toolId);
  if (!contract) throw new Error('Execution denied: output contract missing for ' + toolId + '.');
  const tool = getToolById(toolId);
  if (!tool) throw new Error('Execution denied: canonical tool disappeared during execution.');

  const prefix = new Uint8Array(await output.blob.slice(0, 64).arrayBuffer());
  const variant = contract.variants.find((candidate) => candidate.outputMimeTypes.includes(output.blob.type));
  if (!variant) throw new Error('Execution denied: output MIME is not admitted by the contract.');

  let dimensions: { width: number; height: number } | undefined;
  if (variant.validateDimensions) {
    if (tool.family === 'video') {
      if (typeof document === 'undefined') throw new Error('Browser runtime required for video output verification.');
      const video = document.createElement('video');
      let releaseSource: (() => void) | null = null;
      video.preload = 'metadata';
      try {
        const metadataReady = new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Video output could not be decoded.'));
        });
        releaseSource = await attachVideoBlobSource(video, output.blob, signal);
        await withDeadline(
          metadataReady,
          Math.min(timeoutMs, 30_000),
          signal,
        );
        dimensions = { width: video.videoWidth, height: video.videoHeight };
      } finally {
        releaseSource?.();
        video.removeAttribute('src');
        video.load();
      }
    } else {
      dimensions = await withDeadline(readImageDimensions(output.blob, signal), Math.min(timeoutMs, 30_000), signal);
    }
  }

  assertToolOutputContract(contract, {
    mimeType: output.blob.type,
    byteLength: output.blob.size,
    bytes: prefix,
    filename: output.fileName,
    ...(dimensions ? { dimensions } : {}),
  });
}

function resolveCanonicalTool(toolId: string) {
  const tool = getToolById(toolId);
  if (!tool) throw new Error('Execution denied: unknown tool ' + toolId + '.');
  const capability = getCapability(toolId);
  if (!capability || capability.state !== 'EXECUTABLE') {
    throw new Error('Execution denied: tool ' + toolId + ' is not executable.');
  }
  if (!tool.isReady || tool.operational.outputContractId !== toolId) {
    throw new Error('Execution denied: tool ' + toolId + ' is not release-ready.');
  }
  if (tool.operational.executorId !== toolId) {
    throw new Error('Execution denied: executor binding mismatch for ' + toolId + '.');
  }
  if (tool.executionMode !== 'LOCAL' || tool.requirements.network) {
    throw new Error('Execution denied: tool ' + toolId + ' is not browser-local.');
  }
  return { tool, capability };
}

export async function executeCanonicalTool(
  toolId: string,
  input: CanonicalExecutionInput,
  rawParameters: CanonicalCapabilityParameters = {},
  signal?: AbortSignal,
): Promise<CanonicalExecutionOutput> {
  const { capability } = resolveCanonicalTool(toolId);
  assertNotAborted(signal);
  const parameters = validateCapabilityParameters(toolId, rawParameters);
  await preflightInput(
    toolId,
    input,
    capability.safetyLimits.maxFileSizeBytes,
    capability.safetyLimits.maxPixels,
    capability.safetyLimits.timeoutMs,
    signal,
  );
  const output = await withDeadline(executeMvpTool(toolId, input, parameters, signal), capability.safetyLimits.timeoutMs, signal);
  assertNotAborted(signal);
  if (output.blob.size <= 0) throw new Error('Execution denied: empty artifact from ' + toolId + '.');
  await verifyOutputContract(toolId, output, capability.safetyLimits.timeoutMs, signal);
  const verified = await withDeadline(capability.verifier(input.blob, output.blob, parameters, signal), capability.safetyLimits.timeoutMs, signal);
  if (!verified) throw new Error('Execution failed closed: verifier rejected artifact for ' + toolId + '.');
  return output;
}

export async function executeCanonicalChain(
  steps: readonly { toolId: string; params?: CanonicalCapabilityParameters }[],
  input: CanonicalExecutionInput,
  onStep?: (completed: number, total: number, toolId: string) => void,
  signal?: AbortSignal,
): Promise<CanonicalExecutionOutput> {
  if (!steps.length || steps.length > 4) {
    throw new Error('Execution denied: chain must contain between 1 and 4 steps.');
  }
  let current = input;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    onStep?.(index, steps.length, step.toolId);
    current = await executeCanonicalTool(step.toolId, current, step.params ?? {}, signal);
  }
  return current;
}