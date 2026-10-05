import { getCapability, validateCapabilityParameters, type CanonicalCapabilityParameters } from '../../config/manual-capability-definition.ts';
import { getToolById } from '../../config/registry.ts';
import { getToolChainAdapter, type ChainInput, type ChainOutput } from '../tool-chain-adapters.ts';
import { getVideoToolExecutor, type VideoToolExecutor } from '../video/video-tool-executors.ts';
import { validateFileSafety, MAGIC_BYTE_SIGNATURES } from '../contracts/file-safety.ts';
import { getToolOutputContract } from '../contracts/tool-output-contracts.ts';
import { assertToolOutputContract } from '../contracts/tool-output.ts';

const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;
const VIDEO_MIME = ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/ogg'] as const;
const VIDEO_EXTENSIONS = ['webm', 'mp4', 'mov', 'mkv', 'ogv'] as const;
const MAX_VIDEO_DURATION_SECONDS = 10 * 60;

export type CanonicalExecutionInput = Readonly<{ blob: Blob; fileName: string }>;

function abortError(): Error {
  return typeof DOMException === 'function' ? new DOMException('Canonical execution cancelled.', 'AbortError') : new Error('Canonical execution cancelled.');
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

async function withDeadline<T>(operation: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  assertNotAborted(signal);
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(() => reject(new Error('Canonical execution timed out.'))), Math.max(1, timeoutMs));
    const onAbort = () => finish(() => reject(abortError()));
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); };
    const finish = (fn: () => void) => { if (settled) return; settled = true; cleanup(); fn(); };
    signal?.addEventListener('abort', onAbort, { once: true });
    operation.then((value) => finish(() => resolve(value)), (error) => finish(() => reject(error)));
  });
}

async function preflightInput(toolId: string, input: CanonicalExecutionInput, maxBytes: number, maxPixels: number, signal?: AbortSignal): Promise<void> {
  assertNotAborted(signal);
  const tool = getToolById(toolId);
  if (!tool) throw new Error('Execution denied: unknown canonical tool.');
  if (input.blob.size <= 0 || input.blob.size > maxBytes) throw new Error('Execution denied: input exceeds the canonical file-size boundary.');
  const isVideo = tool.family === 'video';
  const allowedMime = isVideo ? VIDEO_MIME : IMAGE_MIME;
  const allowedExtensions = isVideo ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
  const contentPrefix = new Uint8Array(await input.blob.slice(0, 64).arrayBuffer());
  const safety = validateFileSafety({
    name: input.fileName,
    mime: input.blob.type,
    bytes: contentPrefix.byteLength,
    content: contentPrefix,
  }, {
    allowedMime,
    allowedExtensions,
    maxBytes,
    ...(isVideo ? {} : { magicBytes: [MAGIC_BYTE_SIGNATURES.png, MAGIC_BYTE_SIGNATURES.jpeg, MAGIC_BYTE_SIGNATURES.webp] }),
  });
  if (!safety.safe) throw new Error('Execution denied by file-safety boundary: ' + safety.failures.join('; '));

  if (isVideo) {
    if (typeof document === 'undefined') throw new Error('VIDEO_BROWSER_RUNTIME_REQUIRED');
    const url = URL.createObjectURL(input.blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    try {
      await withDeadline(new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('VIDEO_METADATA_INVALID'));
      }), Math.min(tool.safetyLimits.timeoutMs, 30_000), signal);
      if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > MAX_VIDEO_DURATION_SECONDS) throw new Error('Execution denied: video duration exceeds the canonical 10-minute boundary.');
      if (!Number.isInteger(video.videoWidth) || !Number.isInteger(video.videoHeight) || video.videoWidth < 1 || video.videoHeight < 1) throw new Error('Execution denied: video dimensions are invalid.');
      if (video.videoWidth * video.videoHeight > maxPixels) throw new Error('Execution denied: video dimensions exceed the canonical pixel budget.');
    } finally { URL.revokeObjectURL(url); video.removeAttribute('src'); video.load(); }
    return;
  }

  if (typeof createImageBitmap === 'function') {
    const bitmap = await withDeadline(createImageBitmap(input.blob), Math.min(tool.safetyLimits.timeoutMs, 30_000), signal);
    try { if (bitmap.width * bitmap.height > maxPixels) throw new Error('Execution denied: image dimensions exceed the canonical pixel budget.'); } finally { bitmap.close(); }
  }
}

async function verifyOutputContract(toolId: string, output: ChainOutput, signal?: AbortSignal): Promise<void> {
  const contract = getToolOutputContract(toolId);
  if (!contract) throw new Error('Execution denied: output contract missing for ' + toolId + '.');
  const tool = getToolById(toolId);
  if (!tool) throw new Error('Execution denied: canonical tool disappeared during execution.');
  const prefix = new Uint8Array(await output.blob.slice(0, 64).arrayBuffer());
  const variant = contract.variants.find((candidate) => candidate.outputMimeTypes.includes(output.blob.type));
  if (!variant) throw new Error('Execution denied: output MIME is not admitted by the contract.');
  let dimensions: { width: number; height: number } | undefined;
  if (variant.validateDimensions) {
    if (typeof document === 'undefined') throw new Error('Browser runtime required for output verification.');
    const url = URL.createObjectURL(output.blob);
    if (tool.family === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata'; video.src = url;
      try {
        await withDeadline(new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('Video output could not be decoded.')); }), Math.min(tool.safetyLimits.timeoutMs, 30_000), signal);
        dimensions = { width: video.videoWidth, height: video.videoHeight };
      } finally { URL.revokeObjectURL(url); video.removeAttribute('src'); video.load(); }
    } else if (typeof createImageBitmap === 'function') {
      const bitmap = await withDeadline(createImageBitmap(output.blob), Math.min(tool.safetyLimits.timeoutMs, 30_000), signal);
      try { dimensions = { width: bitmap.width, height: bitmap.height }; } finally { bitmap.close(); URL.revokeObjectURL(url); }
    } else { URL.revokeObjectURL(url); }
  }
  assertToolOutputContract(contract, { mimeType: output.blob.type, byteLength: output.blob.size, bytes: prefix, filename: output.fileName, ...(dimensions ? { dimensions } : {}) });
}

function resolveExecutor(toolId: string): { tool: ReturnType<typeof getToolById> extends infer T ? Exclude<T, undefined> : never; capability: NonNullable<ReturnType<typeof getCapability>>; execute: (input: CanonicalExecutionInput, params: CanonicalCapabilityParameters, signal?: AbortSignal) => Promise<ChainOutput> } {
  const tool = getToolById(toolId);
  if (!tool) throw new Error('Execution denied: unknown tool ' + toolId + '.');
  const capability = getCapability(toolId);
  if (!capability || capability.state !== 'EXECUTABLE') throw new Error('Execution denied: tool ' + toolId + ' is not executable.');
  if (capability.executionMode !== 'LOCAL' || capability.requirements.network) throw new Error('Execution denied: tool ' + toolId + ' is not browser-local.');
  if (capability.operational.executorId !== toolId) throw new Error('Execution denied: executor binding mismatch for ' + toolId + '.');
  if (tool.family === 'video') {
    const executor: VideoToolExecutor | undefined = getVideoToolExecutor(tool);
    if (!executor) throw new Error('Execution denied: video executor missing for ' + toolId + '.');
    return { tool, capability, execute: (input, params, signal) => executor(input.blob, params, tool, signal).then((blob) => ({ blob, fileName: toolId + '-output.webm' })) };
  }
  const adapter = getToolChainAdapter(toolId);
  if (!adapter) throw new Error('Execution denied: local adapter missing for ' + toolId + '.');
  return { tool, capability, execute: (input, params) => adapter(input, params) };
}

export async function executeCanonicalTool(toolId: string, input: CanonicalExecutionInput, rawParameters: CanonicalCapabilityParameters = {}, signal?: AbortSignal): Promise<ChainOutput> {
  const { tool, capability, execute } = resolveExecutor(toolId);
  assertNotAborted(signal);
  if (!tool.isReady || tool.operational.outputContractId !== toolId) throw new Error('Execution denied: tool ' + toolId + ' is not release-ready.');
  const parameters = validateCapabilityParameters(toolId, rawParameters);
  await preflightInput(toolId, input, capability.safetyLimits.maxFileSizeBytes, capability.safetyLimits.maxPixels, signal);
  const output = await withDeadline(execute(input, parameters, signal), capability.safetyLimits.timeoutMs, signal);
  assertNotAborted(signal);
  if (output.blob.size <= 0) throw new Error('Execution denied: empty artifact from ' + toolId + '.');
  await verifyOutputContract(toolId, output, signal);
  const verified = await withDeadline(capability.verifier(input.blob, output.blob, parameters, signal), capability.safetyLimits.timeoutMs, signal);
  if (!verified) throw new Error('Execution failed closed: verifier rejected artifact for ' + toolId + '.');
  return Object.freeze(output);
}

export async function executeCanonicalChain(steps: readonly { toolId: string; params?: CanonicalCapabilityParameters }[], input: CanonicalExecutionInput, onStep?: (completed: number, total: number, toolId: string) => void, signal?: AbortSignal): Promise<ChainOutput> {
  if (!steps.length || steps.length > 8) throw new Error('Execution denied: chain must contain between 1 and 8 steps.');
  let current = input;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    onStep?.(index, steps.length, step.toolId);
    current = await executeCanonicalTool(step.toolId, current, step.params ?? {}, signal);
  }
  return current;
}