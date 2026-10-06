import { createElement, lazy } from 'react';
import { z, type ZodType } from 'zod';
import { LOCALES, type Locale } from '../i18n/config.ts';
import { getAuthoritativeToolSeoName } from '../../config/tool-seo-name-resolver.ts';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { LocalToolId } from '../../tools/image-toolkit/engine.ts';

export type CanonicalCapabilityState = "RECOGNIZED" | "PLANNABLE" | "EXECUTABLE" | "UNAVAILABLE";
export type CanonicalExecutionMode = "LOCAL" | "HYBRID" | "CLOUD";
export type CanonicalCapabilityParameters = Record<string, string | number | boolean>;
export type CanonicalCapabilityVerifier = (
  inputBlob: Blob,
  outputBlob: Blob,
  parameters: CanonicalCapabilityParameters,
  signal?: AbortSignal,
) => Promise<boolean>;
export type CanonicalCapabilityLimits = Readonly<{
  maxPixels: number;
  maxFileSizeBytes: number;
  timeoutMs: number;
}>;
export type CanonicalCapabilityDefinition = Readonly<{
  id: string;
  title: string;
  description: string;
  category: "Images" | "Video";
  family: "image" | "video";
  state: "EXECUTABLE";
  executionMode: "LOCAL";
  execution: "browser-local" | "browser-worker";
  intents: readonly string[];
  parameterSchema: ZodType;
  safetyLimits: CanonicalCapabilityLimits;
  verifier: CanonicalCapabilityVerifier;
  requirements: Readonly<{ browser: true; network: false }>;
  recovery: Readonly<{ maxAttempts: 3; replanOnFailure: false }>;
  operational: Readonly<{
    lifecycle: "ready";
    execution: "browser-local" | "browser-worker";
    contracts: readonly ["structural", "runtime", "artifact"];
    executorId: string;
    outputContractId: string;
  }>;
}>;

const MIME_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
const PARAMETER_SCHEMAS = {
  "background-remover": z.object({ tolerance: z.number().finite().min(0).max(255).optional() }).strict(),
  "image-upscaler": z.object({ scale: z.number().finite().positive().max(8).optional() }).strict(),
  "image-cropper": z.object({
    x: z.number().int().nonnegative().max(40_000).optional(),
    y: z.number().int().nonnegative().max(40_000).optional(),
    cropWidth: z.number().int().positive().max(40_000).optional(),
    cropHeight: z.number().int().positive().max(40_000).optional(),
    width: z.number().int().positive().max(4000).optional(),
    height: z.number().int().positive().max(4000).optional(),
    aspectRatio: z.string().regex(/^\d{1,3}:\d{1,3}$/).optional(),
    mode: z.literal("exact").optional(),
  }).strict(),
  "image-compressor": z.object({
    quality: z.number().finite().min(0.01).max(1).optional(),
    format: z.enum(MIME_TYPES).optional(),
    targetSizeKB: z.number().finite().int().positive().max(64 * 1024).optional(),
    maxWidth: z.number().int().positive().max(4000).optional(),
    maxHeight: z.number().int().positive().max(4000).optional(),
  }).strict(),
  "image-converter": z.object({ format: z.enum(MIME_TYPES) }).strict(),
  "image-effects": z.object({
    brightness: z.number().finite().min(0).max(200).optional(),
    contrast: z.number().finite().min(0).max(200).optional(),
    saturate: z.number().finite().min(0).max(200).optional(),
    grayscale: z.number().finite().min(0).max(100).optional(),
  }).strict(),
  "video-trimmer": z.object({
    startSec: z.number().finite().min(0).max(86_400).optional(),
    endSec: z.number().finite().min(0).max(86_400).optional(),
  }).strict(),
  "video-cropper": z.object({
    x: z.number().finite().min(0).max(20_000).optional(),
    y: z.number().finite().min(0).max(20_000).optional(),
    width: z.number().int().positive().max(20_000),
    height: z.number().int().positive().max(20_000),
  }).strict(),
  "video-resizer": z.object({
    width: z.number().int().positive().max(8000),
    height: z.number().int().positive().max(8000),
    fps: z.number().finite().positive().max(120).optional(),
  }).strict(),
  "video-compressor": z.object({
    videoBitsPerSecond: z.number().int().positive().max(50_000_000).optional(),
    audioBitsPerSecond: z.number().int().positive().max(512_000).optional(),
  }).strict(),
} as const;

export const MVP_EXECUTABLE_TOOL_IDS = Object.freeze([
  "background-remover","image-upscaler","image-cropper","image-compressor","image-converter",
  "image-effects","video-trimmer","video-cropper","video-resizer","video-compressor",
] as const);

const INTENTS: Record<string, readonly string[]> = {
  "background-remover": ["remove background","transparent background","cut out background","background removal","إزالة الخلفية","خلفية شفافة"],
  "image-upscaler": ["upscale","sharper","higher quality","increase resolution","make it clearer","رفع الجودة","زيادة الدقة"],
  "image-cropper": ["crop","resize","dimensions","aspect ratio","قص الصورة","تغيير الحجم"],
  "image-compressor": ["compress","smaller","reduce size","file size","lighter","ضغط الصور","تصغير حجم الصورة"],
  "image-converter": ["convert format","jpg to png","png to jpg","webp","change format","تحويل الصيغة","تحويل الصورة"],
  "image-effects": ["brightness","contrast","saturation","grayscale","adjust image","سطوع","تباين","تشبع"],
  "video-trimmer": ["trim video","cut video","video trim","اقتطاع الفيديو","اقتطع الفيديو","اقتطع أول","قص أول"],
  "video-cropper": ["crop video","video crop","قص الفيديو من الاطراف","قص الفيديو من الأطراف"],
  "video-resizer": ["resize video","change video resolution","video dimensions","تغيير حجم الفيديو","تغيير دقة الفيديو"],
  "video-compressor": ["compress video","reduce video size","video compression","ضغط الفيديو","تصغير حجم الفيديو"],
};

const META: Record<string, {title:string;description:string;category:"Images"|"Video";family:"image"|"video"}> = {
  "background-remover": {title:"Background Remover",description:"Remove connected, uniform backgrounds locally.",category:"Images",family:"image"},
  "image-upscaler": {title:"Image Upscaler",description:"Increase image dimensions with high-quality resampling.",category:"Images",family:"image"},
  "image-cropper": {title:"Image Cropper",description:"Crop and resize images for exact dimensions.",category:"Images",family:"image"},
  "image-compressor": {title:"Image Compressor",description:"Reduce JPG, PNG, and WebP file size in your browser.",category:"Images",family:"image"},
  "image-converter": {title:"Image Converter",description:"Convert common raster image formats locally.",category:"Images",family:"image"},
  "image-effects": {title:"Image Effects",description:"Apply brightness, contrast, saturation, and grayscale.",category:"Images",family:"image"},
  "video-trimmer": {title:"Video Trimmer",description:"Trim a video locally in the browser with WebCodecs-compatible playback and MediaRecorder output.",category:"Video",family:"video"},
  "video-cropper": {title:"Video Cropper",description:"Crop a video locally to a deterministic rectangle.",category:"Video",family:"video"},
  "video-resizer": {title:"Video Resizer",description:"Resize a video locally to exact output dimensions.",category:"Video",family:"video"},
  "video-compressor": {title:"Video Compressor",description:"Compress a video locally with bounded browser recording bitrate.",category:"Video",family:"video"},
};

type MediaDimensions = Readonly<{ width: number; height: number; duration?: number }>;

async function readImageDimensions(blob: Blob, signal?: AbortSignal): Promise<MediaDimensions | undefined> {
  if (signal?.aborted || !blob.type.startsWith("image/")) return undefined;
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }
  if (typeof document === "undefined") return undefined;
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Image verification aborted.", "AbortError"));
      const cleanup = () => signal?.removeEventListener("abort", onAbort);
      image.onload = () => { cleanup(); resolve(); };
      image.onerror = () => { cleanup(); reject(new Error("Image output could not be decoded.")); };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readVideoDimensions(blob: Blob, signal?: AbortSignal): Promise<MediaDimensions | undefined> {
  if (signal?.aborted || blob.type !== "video/webm" || typeof document === "undefined") return undefined;
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Video verification aborted.", "AbortError"));
      const cleanup = () => signal?.removeEventListener("abort", onAbort);
      video.onloadedmetadata = () => { cleanup(); resolve(); };
      video.onerror = () => { cleanup(); reject(new Error("Video output could not be decoded.")); };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.videoWidth <= 0 || video.videoHeight <= 0) return undefined;
    return { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

function hasNonNeutralEffect(parameters: CanonicalCapabilityParameters): boolean {
  return ["brightness", "contrast", "saturate", "grayscale"].some((name) => {
    const value = parameters[name];
    if (typeof value !== "number") return false;
    const neutral = name === "grayscale" ? 0 : 100;
    return value !== neutral;
  });
}

async function hasMeaningfulPixelChange(input: Blob, output: Blob, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted || typeof document === "undefined") return false;
  const [inputBitmap, outputBitmap] = await Promise.all([createImageBitmap(input), createImageBitmap(output)]);
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  try {
    context.clearRect(0, 0, size, size);
    context.drawImage(inputBitmap, 0, 0, size, size);
    const source = context.getImageData(0, 0, size, size).data;
    context.clearRect(0, 0, size, size);
    context.drawImage(outputBitmap, 0, 0, size, size);
    const target = context.getImageData(0, 0, size, size).data;
    let changed = 0;
    let totalDelta = 0;
    for (let index = 0; index < target.length; index += 4) {
      const delta = Math.abs(source[index] - target[index]) + Math.abs(source[index + 1] - target[index + 1]) + Math.abs(source[index + 2] - target[index + 2]) + Math.abs(source[index + 3] - target[index + 3]);
      totalDelta += delta;
      if (delta >= 12) changed += 1;
    }
    return changed >= 2 && totalDelta >= 64;
  } finally {
    inputBitmap.close();
    outputBitmap.close();
  }
}

const defaultVerifier: CanonicalCapabilityVerifier = async (input, output, _parameters, signal) => {
  if (signal?.aborted || output.size <= 0 || !output.type.startsWith("image/")) return false;
  const [inputDimensions, outputDimensions] = await Promise.all([readImageDimensions(input, signal), readImageDimensions(output, signal)]);
  return Boolean(
    inputDimensions &&
    outputDimensions &&
    outputDimensions.width > 0 &&
    outputDimensions.height > 0,
  );
};

const backgroundRemovalVerifier: CanonicalCapabilityVerifier = async (input, output, _parameters, signal) => {
  if (signal?.aborted || output.size <= 0 || output.type !== "image/png") return false;
  const [inputDimensions, outputDimensions] = await Promise.all([readImageDimensions(input, signal), readImageDimensions(output, signal)]);
  if (!inputDimensions || !outputDimensions || inputDimensions.width !== outputDimensions.width || inputDimensions.height !== outputDimensions.height) return false;
  return hasMeaningfulPixelChange(input, output, signal);
};

const upscalerVerifier: CanonicalCapabilityVerifier = async (input, output, parameters, signal) => {
  if (signal?.aborted || output.size <= 0 || !output.type.startsWith("image/")) return false;
  const [inputDimensions, outputDimensions] = await Promise.all([readImageDimensions(input, signal), readImageDimensions(output, signal)]);
  if (!inputDimensions || !outputDimensions) return false;
  const scale = typeof parameters.scale === "number" ? parameters.scale : 2;
  return outputDimensions.width === Math.max(1, Math.round(inputDimensions.width * scale)) &&
    outputDimensions.height === Math.max(1, Math.round(inputDimensions.height * scale));
};

const cropperVerifier: CanonicalCapabilityVerifier = async (input, output, parameters, signal) => {
  if (signal?.aborted || output.size <= 0 || output.type !== "image/png") return false;
  const outputDimensions = await readImageDimensions(output, signal);
  if (!outputDimensions) return false;
  const width = typeof parameters.width === "number" ? parameters.width : undefined;
  const height = typeof parameters.height === "number" ? parameters.height : undefined;
  if (width !== undefined || height !== undefined) {
    return outputDimensions.width === (width ?? outputDimensions.width) &&
      outputDimensions.height === (height ?? outputDimensions.height);
  }
  const inputDimensions = await readImageDimensions(input, signal);
  if (!inputDimensions) return false;
  const ratio = typeof parameters.aspectRatio === "string" ? parameters.aspectRatio.split(":").map(Number) : [1, 1];
  const ratioValue = ratio[1] > 0 ? ratio[0] / ratio[1] : 1;
  const sourceRatio = inputDimensions.width / inputDimensions.height;
  const cropWidth = sourceRatio > ratioValue ? Math.max(1, Math.round(inputDimensions.height * ratioValue)) : inputDimensions.width;
  const cropHeight = sourceRatio > ratioValue ? inputDimensions.height : Math.max(1, Math.round(inputDimensions.width / ratioValue));
  return outputDimensions.width === cropWidth && outputDimensions.height === cropHeight;
};

const targetSizeVerifier: CanonicalCapabilityVerifier = async (input, output, parameters, signal) => {
  if (signal?.aborted || output.size <= 0 || !output.type.startsWith("image/")) return false;
  const target = typeof parameters.targetSizeKB === "number" ? parameters.targetSizeKB : undefined;
  if (target !== undefined && output.size > target * 1024) return false;
  if (target === undefined && output.size > input.size && typeof parameters.quality === "number") return false;
  return true;
};

const formatVerifier: CanonicalCapabilityVerifier = async (_input, output, parameters, signal) => {
  const format = parameters.format;
  return !signal?.aborted && output.size > 0 && typeof format === "string" && output.type === format;
};

const effectsVerifier: CanonicalCapabilityVerifier = async (input, output, parameters, signal) => {
  if (signal?.aborted || output.size <= 0 || output.type !== "image/png" || !hasNonNeutralEffect(parameters)) return false;
  const [inputDimensions, outputDimensions] = await Promise.all([readImageDimensions(input, signal), readImageDimensions(output, signal)]);
  if (!inputDimensions || !outputDimensions || inputDimensions.width !== outputDimensions.width || inputDimensions.height !== outputDimensions.height) return false;
  return hasMeaningfulPixelChange(input, output, signal);
};

const videoVerifier: CanonicalCapabilityVerifier = async (input, output, parameters, signal) => {
  if (signal?.aborted || output.size <= 0 || output.type !== "video/webm") return false;
  const [inputMeta, outputMeta] = await Promise.all([readVideoDimensions(input, signal), readVideoDimensions(output, signal)]);
  if (!inputMeta || !outputMeta) return false;
  if (parameters.width !== undefined && parameters.height !== undefined) {
    if (outputMeta.width !== Number(parameters.width) || outputMeta.height !== Number(parameters.height)) return false;
  }
  if (parameters.startSec !== undefined || parameters.endSec !== undefined) {
    const start = Number(parameters.startSec ?? 0);
    const end = Number(parameters.endSec ?? inputMeta.duration ?? 0);
    const expected = Math.max(0.001, Math.min(inputMeta.duration ?? end, end) - Math.min(Math.max(0, start), Math.max(0, (inputMeta.duration ?? 0) - 0.001)));
    if (Math.abs((outputMeta.duration ?? 0) - expected) > 0.35) return false;
  }
  if (parameters.videoBitsPerSecond !== undefined && output.size >= input.size) return false;
  return outputMeta.duration !== undefined && outputMeta.duration > 0;
};

function createCapability(id:(typeof MVP_EXECUTABLE_TOOL_IDS)[number]):CanonicalCapabilityDefinition{
  const meta=META[id];
  const isVideo=id.startsWith("video-");
  const execution = "browser-local" as const;
  const safetyLimits=Object.freeze(isVideo
    ? {maxPixels:64_000_000,maxFileSizeBytes:512*1024*1024,timeoutMs:10*60*1000}
    : {maxPixels:16_000_000,maxFileSizeBytes:64*1024*1024,timeoutMs:30_000});
  const verifier=id==="background-remover"?backgroundRemovalVerifier:id==="image-upscaler"?upscalerVerifier:id==="image-cropper"?cropperVerifier:id==="image-compressor"?targetSizeVerifier:id==="image-converter"?formatVerifier:id==="image-effects"?effectsVerifier:isVideo?videoVerifier:defaultVerifier;
  return Object.freeze({
    id,...meta,state:"EXECUTABLE" as const,executionMode:"LOCAL" as const,execution,
    intents:Object.freeze(INTENTS[id]),
    parameterSchema:PARAMETER_SCHEMAS[id],
    safetyLimits,verifier,
    requirements:Object.freeze({browser:true as const,network:false as const}),
    recovery:Object.freeze({maxAttempts:3 as const,replanOnFailure:false as const}),
    operational:Object.freeze({lifecycle:"ready" as const,execution,contracts:["structural","runtime","artifact"] as const,executorId:id,outputContractId:id}),
  });
}
export const CAPABILITY_DEFINITIONS:readonly CanonicalCapabilityDefinition[]=Object.freeze(MVP_EXECUTABLE_TOOL_IDS.map(createCapability));
const BY_ID=new Map(CAPABILITY_DEFINITIONS.map((definition)=>[definition.id,definition]));
export function getCanonicalCapabilityDefinition(id:string){return BY_ID.get(id);}

export function getCapability(id: string) {
  return getCanonicalCapabilityDefinition(id);
}

export function validateCapabilityParameters(id: string, parameters: CanonicalCapabilityParameters) {
  const definition = getCanonicalCapabilityDefinition(id);
  if (!definition) throw new Error(`Unknown manual capability: ${id}`);
  const result = definition.parameterSchema.safeParse(parameters);
  if (!result.success) throw new Error(`Invalid parameters for manual capability ${id}.`);
  return result.data;
}

export type ToolFamily = 'image' | 'video' | 'audio' | 'ai' | 'editor';
export type ToolCategory = 'Images' | 'Video' | 'Audio' | 'AI' | 'Editor';
export type ToolLifecycle = 'experimental' | 'beta' | 'ready' | 'deprecated';
export type ToolExecution = 'browser-local' | 'browser-worker' | 'remote';
export type ToolContractLevel = 'structural' | 'runtime' | 'artifact';
export type ToolRecoveryPolicy = Readonly<{ maxAttempts: number; replanOnFailure: boolean }>;
export type ToolRequirements = Readonly<{ browser: true; network: boolean }>
export type ToolOperationalProfile = Readonly<{
  lifecycle: ToolLifecycle;
  execution: ToolExecution;
  contracts: readonly ToolContractLevel[];
  executorId: string | null;
  outputContractId: string | null;
}>;
export type ToolSource = Readonly<{
  id: string;
  title: string;
  path: string;
  description: string;
  family?: ToolFamily;
  category: ToolCategory;
  isReady: boolean;
  aliases?: readonly string[];
  component: LazyExoticComponent<ComponentType>;
}>;

// ToolConfig is the canonical source shape consumed by the definition builder.
type ToolConfig = ToolSource;

const createImageToolkitComponent = (toolId: Exclude<LocalToolId, 'ai-image-generator' | 'image-compressor'>) =>
  lazy(() =>
    import('@/tools/image-toolkit').then((m) => ({
      default: ((props: Record<string, unknown>) => createElement(m.ImageToolPage, { ...props, toolId })) as ComponentType,
    })),
  );

// Consolidated capability types remain exported here for backward compatibility.
export type CapabilityState = CanonicalCapabilityState;
export type ExecutionMode = CanonicalExecutionMode;

const IMAGE_TOOL_CONFIGS: readonly ToolSource[] = Object.freeze([
  { id: 'filter-mask', title: 'Filter Mask', path: '/en/filter-mask', description: 'Live camera filters with instant local preview.', category: 'Images', isReady: true, aliases: ['/en/filters'], component: lazy(() => import('@/tools/filter-mask').then((m) => ({ default: m.FilterMaskTool }))) },
  { id: 'image-compressor', title: 'Image Compressor', path: '/en/image-compressor', description: 'Reduce JPG, PNG, and WebP file size in your browser.', category: 'Images', isReady: true, aliases: ['/ar/image-compressor'], component: lazy(() => import('@/tools/image-compressor/index.tsx').then((m) => ({ default: m.ImageCompressor }))) },
  { id: 'background-remover', title: 'Background Remover', path: '/en/background-remover', description: 'Remove connected, uniform backgrounds locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/background-remover').then((m) => ({ default: m.BackgroundRemoverTool }))) },
  { id: 'image-upscaler', title: 'Image Upscaler', path: '/en/image-upscaler', description: 'Increase image dimensions with high-quality resampling.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/image-upscaler').then((m) => ({ default: m.ImageUpscalerTool }))) },
  { id: 'image-converter', title: 'Image Converter', path: '/en/image-converter', description: 'Convert common raster image formats locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/image-converter').then((m) => ({ default: m.ImageConverterTool }))) },
  { id: 'object-remover', title: 'Object Remover', path: '/en/object-remover', description: 'Remove selected rectangular regions locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/object-remover').then((m) => ({ default: m.ObjectRemoverTool }))) },
  { id: 'watermark-remover', title: 'Watermark Remover', path: '/en/watermark-remover', description: 'Clean selected watermark regions locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/watermark-remover').then((m) => ({ default: m.WatermarkRemoverTool }))) },
  { id: 'image-cropper', title: 'Image Cropper', path: '/en/image-cropper', description: 'Crop and resize images for exact dimensions.', category: 'Images', isReady: true, aliases: ['/en/crop-resize'], component: lazy(() => import('@/tools/image-cropper')) },
  { id: 'image-to-svg', title: 'Image to SVG', path: '/en/image-to-svg', description: 'Convert a raster image to downloadable SVG.', category: 'Images', isReady: true, aliases: ['/en/raster-to-svg'], component: lazy(() => import('@/tools/image-to-svg')) },
  { id: 'image-ocr', title: 'Image OCR', path: '/en/image-ocr', description: 'Extract text from images with OCR.', category: 'Images', isReady: true, aliases: ['/en/image-to-text'], component: lazy(() => import('@/tools/image-ocr')) },
  { id: 'background-blur', title: 'Background Blur', path: '/en/background-blur', description: 'Blur background regions locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/background-blur')) },
  { id: 'passport-photo-maker', title: 'Passport Photo Maker', path: '/en/passport-photo-maker', description: 'Create standard portrait photo crops.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/passport-photo-maker')) },
  { id: 'watermark-adder', title: 'Watermark Adder', path: '/en/watermark-adder', description: 'Add text watermarks locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/watermark-adder')) },
  { id: 'meme-generator', title: 'Meme Generator', path: '/en/meme-generator', description: 'Create top-and-bottom captioned memes.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/meme-generator')) },
  { id: 'collage-maker', title: 'Collage Maker', path: '/en/collage-maker', description: 'Combine multiple images into a collage.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/collage-maker')) },
  { id: 'image-effects', title: 'Image Effects', path: '/en/image-effects', description: 'Apply brightness, contrast, saturation, and grayscale.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/image-effects')) },
  { id: 'exif-cleaner', title: 'EXIF Cleaner', path: '/en/exif-cleaner', description: 'Strip metadata by browser re-encoding.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/exif-cleaner')) },
  { id: 'svg-optimizer', title: 'SVG Optimizer', path: '/en/svg-optimizer', description: 'Minify SVG comments and whitespace.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/svg-optimizer')) },
  { id: 'mockup-generator', title: 'Mockup Generator', path: '/en/mockup-generator', description: 'Place images inside a simple device mockup.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/mockup-generator')) },
  { id: 'seed', title: 'Seed', path: '/en/seed', description: 'Non-destructive GPU image adjustments with WebGL.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/seed')) },
  { id: 'pix', title: 'Pix Studio', path: '/en/pix', description: 'Professional browser-based image editor with tune, liquify, dispersion, text, history, and PNG export.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/pix')) },
  { id: 'ai-image-generator', title: 'AI Image Generator', path: '/en/ai-image-generator', description: 'Generate images through a configured image endpoint.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/ai-image-generator').then((m) => ({ default: m.AiImageGeneratorTool }))) },
  { id: 'photo-colorizer', title: 'Photo Colorizer', path: '/en/photo-colorizer', description: 'Colorize photos through a configured AI endpoint.', category: 'Images', isReady: false, component: lazy(() => import('@/tools/photo-colorizer')) },
  { id: 'image-rotate', title: 'Rotate Image', path: '/en/image-rotate', description: 'Rotate images locally in your browser.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-rotate') },
  { id: 'image-flip-horizontal', title: 'Flip Image Horizontal', path: '/en/image-flip-horizontal', description: 'Flip images horizontally locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-flip-horizontal') },
  { id: 'image-flip-vertical', title: 'Flip Image Vertical', path: '/en/image-flip-vertical', description: 'Flip images vertically locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-flip-vertical') },
  { id: 'image-brightness', title: 'Brightness', path: '/en/image-brightness', description: 'Adjust image brightness locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-brightness') },
  { id: 'image-contrast', title: 'Contrast', path: '/en/image-contrast', description: 'Adjust image contrast locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-contrast') },
  { id: 'image-saturation', title: 'Saturation', path: '/en/image-saturation', description: 'Adjust image saturation locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-saturation') },
  { id: 'image-grayscale', title: 'Grayscale', path: '/en/image-grayscale', description: 'Convert images to grayscale locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-grayscale') },
  { id: 'image-invert', title: 'Invert Colors', path: '/en/image-invert', description: 'Invert image colors locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-invert') },
  { id: 'image-sepia', title: 'Sepia', path: '/en/image-sepia', description: 'Apply a sepia effect locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-sepia') },
  { id: 'image-blur', title: 'Blur', path: '/en/image-blur', description: 'Apply a blur effect locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-blur') },
  { id: 'image-sharpen', title: 'Sharpen', path: '/en/image-sharpen', description: 'Sharpen images locally.', category: 'Images', isReady: true, component: createImageToolkitComponent('image-sharpen') },
  { id: 'video-trimmer', title: 'Video Trimmer', path: '/en/video-trimmer', description: 'Trim a video locally in the browser with WebCodecs-compatible playback and MediaRecorder output.', family: 'video', category: 'Video', isReady: true, component: lazy(() => import('@/tools/video-local').then((m) => ({ default: m.VideoLocalTool }))) },
  { id: 'video-cropper', title: 'Video Cropper', path: '/en/video-cropper', description: 'Crop a video locally to a deterministic rectangle.', family: 'video', category: 'Video', isReady: true, component: lazy(() => import('@/tools/video-local').then((m) => ({ default: m.VideoLocalTool }))) },
  { id: 'video-resizer', title: 'Video Resizer', path: '/en/video-resizer', description: 'Resize a video locally to exact output dimensions.', family: 'video', category: 'Video', isReady: true, component: lazy(() => import('@/tools/video-local').then((m) => ({ default: m.VideoLocalTool }))) },
  { id: 'video-compressor', title: 'Video Compressor', path: '/en/video-compressor', description: 'Compress a video locally with bounded browser recording bitrate.', family: 'video', category: 'Video', isReady: true, component: lazy(() => import('@/tools/video-local').then((m) => ({ default: m.VideoLocalTool }))) },
]);

const DEFAULT_MAX_PIXELS = 16_000_000;
const DEFAULT_MAX_FILE_SIZE_BYTES = 64 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const COMMON_PARAMETERS = z.record(z.string().max(64), z.union([z.string(), z.number().finite(), z.boolean()]));

const TOOL_INTENTS: Readonly<Record<string, readonly string[]>> = {
  'filter-mask': ['live filter', 'camera filter', 'live camera', 'filters', 'فلتر مباشر', 'فلاتر الكاميرا'],
  'image-compressor': ['compress', 'smaller', 'reduce size', 'file size', 'lighter', 'ضغط الصور', 'تصغير حجم الصورة'],
  'background-remover': ['remove background', 'transparent background', 'cut out background', 'background removal', 'إزالة الخلفية', 'خلفية شفافة'],
  'image-upscaler': ['upscale', 'sharper', 'higher quality', 'increase resolution', 'make it clearer', 'رفع الجودة', 'زيادة الدقة'],
  'image-converter': ['convert format', 'jpg to png', 'png to jpg', 'webp', 'change format', 'تحويل الصيغة', 'تحويل الصورة'],
  'image-ocr': ['ocr', 'extract text', 'text from image', 'read text', 'استخراج النص', 'قراءة النص'],
  'image-cropper': ['crop', 'resize', 'dimensions', 'aspect ratio', 'قص الصورة', 'تغيير الحجم'],
  'image-effects': ['brightness', 'contrast', 'saturation', 'grayscale', 'adjust image', 'سطوع', 'تباين', 'تشبع'],
  'image-to-svg': ['image to svg', 'raster to svg', 'convert image to svg', 'تحويل الصورة إلى svg', 'صورة إلى svg'],
  'background-blur': ['background blur', 'blur background', 'طمس الخلفية', 'ضبابية الخلفية'],
  'passport-photo-maker': ['passport photo', 'id photo', 'passport picture', 'صورة جواز سفر', 'صورة شخصية للهوية'],
  'watermark-adder': ['add watermark', 'watermark text', 'إضافة علامة مائية', 'إضافة علامة على الصورة'],
  'meme-generator': ['meme', 'meme generator', 'صورة ميم', 'ميم'],
  'collage-maker': ['collage', 'photo collage', 'image collage', 'كولاج', 'دمج الصور'],
  'exif-cleaner': ['remove exif', 'clean metadata', 'strip metadata', 'تنظيف البيانات الوصفية', 'إزالة exif'],
  'svg-optimizer': ['optimize svg', 'minify svg', 'ضغط svg', 'تحسين svg'],
  'mockup-generator': ['mockup', 'device mockup', 'نموذج عرض', 'موكاب'],
  'seed': ['seed editor', 'gpu adjustments', 'image adjustments', 'تعديلات الصورة', 'تحسينات gpu'],
  'pix': ['pix studio', 'photo editor', 'image editor', 'تحرير الصورة', 'محرر الصور'],
  'watermark-remover': ['remove watermark', 'erase watermark', 'إزالة العلامة المائية'],
  'object-remover': ['remove object', 'erase object', 'delete object', 'إزالة عنصر', 'حذف عنصر'],
  'ai-image-generator': ['generate image', 'create image with ai', 'text to image', 'make an image', 'إنشاء صورة بالذكاء الاصطناعي'],
  'image-rotate': ['rotate image','turn image','تدوير الصورة'],
  'image-flip-horizontal': ['flip horizontal','mirror image','قلب أفقي','عكس أفقي'],
  'image-flip-vertical': ['flip vertical','قلب رأسي','عكس رأسي'],
  'image-brightness': ['brightness','brighten image','سطوع الصورة','تفتيح الصورة'],
  'image-contrast': ['contrast','increase contrast','تباين الصورة'],
  'image-saturation': ['saturation','increase saturation','تشبع الصورة'],
  'image-grayscale': ['grayscale','black and white','أبيض وأسود','تدرج رمادي'],
  'image-invert': ['invert colors','negative image','عكس الألوان'],
  'image-sepia': ['sepia','sepia effect','تأثير سيبيا'],
  'image-blur': ['blur image','soften image','تمويه الصورة','ضبابية الصورة'],
  'image-sharpen': ['sharpen image','make image sharper','زيادة حدة الصورة'],
  'video-trimmer': ['trim video', 'cut video', 'video trim', 'قص الفيديو', 'اقتطاع الفيديو'],
  'video-cropper': ['crop video', 'video crop', 'قص الفيديو من الاطراف', 'قص الفيديو من الأطراف'],
  'video-resizer': ['resize video', 'change video resolution', 'video dimensions', 'تغيير حجم الفيديو', 'تغيير دقة الفيديو'],
  'video-compressor': ['compress video', 'reduce video size', 'video compression', 'ضغط الفيديو', 'تصغير حجم الفيديو'],
};

const EXECUTABLE_IDS: ReadonlySet<string> = new Set(MVP_EXECUTABLE_TOOL_IDS);
const verifierFor = (toolId: string): CapabilityVerifier => {
  if (toolId === 'image-compressor') return targetSizeVerifier;
  if (toolId === 'image-converter') return formatVerifier;
  if (toolId === 'background-remover') return backgroundRemovalVerifier;
  if (toolId === 'image-upscaler') return upscalerVerifier;
  if (toolId === 'image-cropper') return cropperVerifier;
  if (toolId === 'image-effects') return effectsVerifier;
  if (toolId.startsWith('video-')) return videoVerifier;
  return defaultVerifier;
};

const executionFor = (mode: ExecutionMode): ToolExecution => {
  if (mode === 'LOCAL') return 'browser-local';
  if (mode === 'HYBRID') return 'browser-worker';
  return 'remote';
};

const stateFor = (tool: ToolConfig): CapabilityState => {
  if (!tool.isReady) return 'UNAVAILABLE';
  if (EXECUTABLE_IDS.has(tool.id)) return 'EXECUTABLE';
  if (tool.id in TOOL_INTENTS) return 'PLANNABLE';
  return 'RECOGNIZED';
};

function localizedRoute(path: string, locale: Locale): string {
  const route = path.replace(/^\/en(?=\/|$)/, '');
  return `/${locale}${route}`;
}

export function toToolDefinition(tool: ToolConfig): ToolDefinition {
  const routes = Object.fromEntries(LOCALES.map((locale) => [locale, localizedRoute(tool.path, locale)])) as Record<Locale, string>;
  const canonicalCapability = getCanonicalCapabilityDefinition(tool.id) as CanonicalCapabilityDefinition | undefined;
  const capabilityState = canonicalCapability?.state ?? stateFor(tool);
  const executionMode: ExecutionMode = canonicalCapability?.executionMode ?? (tool.id === 'ai-image-generator' || tool.id === 'photo-colorizer' ? 'CLOUD' : 'LOCAL');
  const parameterSchema = canonicalCapability?.parameterSchema ?? COMMON_PARAMETERS;
  const safetyLimits = canonicalCapability?.safetyLimits ?? Object.freeze(tool.id.startsWith('video-')
    ? { maxPixels: 64_000_000, maxFileSizeBytes: 512 * 1024 * 1024, timeoutMs: 10 * 60 * 1000 }
    : { maxPixels: DEFAULT_MAX_PIXELS, maxFileSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES, timeoutMs: DEFAULT_TIMEOUT_MS });
  const verifier = canonicalCapability?.verifier ?? verifierFor(tool.id);
  const intents = Object.freeze(canonicalCapability?.intents ?? TOOL_INTENTS[tool.id] ?? []);
  const operational: ToolOperationalProfile = canonicalCapability?.operational ?? Object.freeze({
    lifecycle: tool.isReady ? 'ready' : 'experimental',
    execution: executionFor(executionMode),
    contracts: Object.freeze(['structural', 'runtime', 'artifact'] as const),
    executorId: capabilityState === 'EXECUTABLE' ? tool.id : null,
    outputContractId: tool.isReady ? tool.id : null,
  });
  const requirements: ToolRequirements = canonicalCapability?.requirements ?? Object.freeze({ browser: true, network: executionMode === 'CLOUD' });
  const recovery: ToolRecoveryPolicy = canonicalCapability?.recovery ?? Object.freeze({ maxAttempts: capabilityState === 'EXECUTABLE' ? 3 : 0, replanOnFailure: false });
  return Object.freeze({
    id: tool.id,
    family: tool.family ?? 'image',
    title: tool.title,
    description: tool.description,
    category: tool.category,
    isReady: tool.isReady,
    path: tool.path,
    routes: Object.freeze(routes),
    aliases: Object.freeze([...(tool.aliases ?? [])]),
    component: tool.component,
    capability: Object.freeze({ state: capabilityState, intents }),
    executionMode,
    parameterSchema,
    safetyLimits,
    verifier,
    requirements,
    recovery,
    operational,
    localization: Object.freeze({ titleKey: `tool.${tool.id}.title`, descriptionKey: `tool.${tool.id}.description` }),
    seo: Object.freeze({ title: `${tool.title} | FLIXO`, description: tool.description, robots: 'index,follow,max-image-preview:large' as const }),
  });
}


export const TOOL_DEFINITIONS: readonly ToolDefinition[] = Object.freeze(IMAGE_TOOL_CONFIGS.map(toToolDefinition));

const byId = new Map(TOOL_DEFINITIONS.map((tool) => [tool.id, tool]));
export function getToolDefinition(id: string): ToolDefinition | undefined { return byId.get(id); }
export type ManagedTool = ToolDefinition;
export type ToolCatalog = Readonly<{
  readonly all: readonly ManagedTool[];
  readonly ready: readonly ManagedTool[];
  readonly byId: ReadonlyMap<string, ManagedTool>;
  readonly byPath: ReadonlyMap<string, ManagedTool>;
  readonly byAlias: ReadonlyMap<string, ManagedTool>;
  readonly fingerprint: string;
}>;

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotateRight = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

function sha256Hex(value: string): string {
  const input = new TextEncoder().encode(value);
  const bitLength = input.length * 8;
  const totalLength = ((input.length + 9 + 63) >> 6) << 6;
  const bytes = new Uint8Array(totalLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(totalLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < totalLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const s0 = (rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3)) >>> 0;
      const s1 = (rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10)) >>> 0;
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let cc = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let index = 0; index < 64; index += 1) {
      const s1 = (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0;
      const choose = ((e & f) ^ ((~e) & g)) >>> 0;
      const temp1 = (h + s1 + choose + SHA256_K[index] + words[index]) >>> 0;
      const s0 = (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & cc) ^ (b & cc)) >>> 0;
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = cc;
      cc = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + cc) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((valuePart) => valuePart.toString(16).padStart(8, '0')).join('');
}

function freezeMap<T>(map: Map<string, T>): ReadonlyMap<string, T> {
  return map;
}

function catalogFingerprint(tools: readonly ToolDefinition[]): string {
  const payload = tools.map((tool) => ({
    id: tool.id,
    path: tool.path,
    aliases: [...tool.aliases].sort(),
    isReady: tool.isReady,
    capability: tool.capability,
    executionMode: tool.executionMode,
    operational: tool.operational,
    requirements: tool.requirements,
    recovery: tool.recovery,
  }));
  return sha256Hex(JSON.stringify(payload));
}

export function createToolCatalog(source: readonly ToolDefinition[]): ToolCatalog {
  const all = Object.freeze([...source].slice().sort((a, b) => a.id.localeCompare(b.id)));
  const byId = new Map<string, ToolDefinition>();
  const byPath = new Map<string, ToolDefinition>();
  const byAlias = new Map<string, ToolDefinition>();
  const claimedRoutes = new Set<string>();

  for (const tool of all) {
    if (!tool.id.trim()) throw new Error('Tool id must not be empty.');
    if (byId.has(tool.id)) throw new Error(`Duplicate managed tool id: ${tool.id}`);
    if (claimedRoutes.has(tool.path)) throw new Error(`Duplicate managed tool path: ${tool.path}`);
    if (!tool.component) throw new Error(`Tool component is missing: ${tool.id}`);
    if (!tool.parameterSchema) throw new Error(`Tool input contract is missing: ${tool.id}`);
    if (!tool.verifier) throw new Error(`Tool verifier contract is missing: ${tool.id}`);
    if (!tool.recovery || tool.recovery.maxAttempts < 0) throw new Error(`Tool recovery contract is invalid: ${tool.id}`);
    if (!tool.operational || !tool.operational.lifecycle || !tool.operational.execution) throw new Error(`Tool operational profile is missing: ${tool.id}`);
    byId.set(tool.id, tool);
    byPath.set(tool.path, tool);
    claimedRoutes.add(tool.path);
  }

  for (const tool of all) {
    for (const alias of tool.aliases) {
      if (claimedRoutes.has(alias)) throw new Error(`Duplicate managed tool route: ${alias}`);
      claimedRoutes.add(alias);
      byAlias.set(alias, tool);
    }
  }

  if (byId.size !== all.length) throw new Error(`Tool catalog discovery mismatch: indexed=${byId.size}, source=${all.length}`);

  return Object.freeze({
    all,
    ready: Object.freeze(all.filter((tool) => tool.isReady)),
    byId: freezeMap(byId),
    byPath: freezeMap(byPath),
    byAlias: freezeMap(byAlias),
    fingerprint: catalogFingerprint(all),
  });
}

export type ToolManifestEntry = ToolDefinition & {
  readonly seoByLocale: Readonly<Record<Locale, { readonly title: string }>>;
};

function withLocalizedSeo(tools: readonly ToolDefinition[]): readonly ToolManifestEntry[] {
  return tools.map((tool) => {
    const seoByLocale = Object.fromEntries(
      LOCALES.map((locale) => {
        const name = getAuthoritativeToolSeoName(tool, locale);
        if (!name) throw new Error(`Missing reviewed SEO name: ${tool.id}:${locale}`);
        return [locale, { title: `${name} | FLIXO` }];
      }),
    ) as Record<Locale, { readonly title: string }>;

    return Object.freeze({ ...tool, seoByLocale: Object.freeze(seoByLocale) });
  });
}

export const TOOL_REGISTRY = TOOL_DEFINITIONS;
export const TOOL_CATALOG: ToolCatalog = createToolCatalog(TOOL_REGISTRY);
export const TOOL_MANIFEST: readonly ToolManifestEntry[] = Object.freeze(withLocalizedSeo(TOOL_REGISTRY));

const TOOL_BY_ID = new Map(TOOL_REGISTRY.map((tool) => [tool.id, tool]));
const TOOL_BY_PATH = new Map<string, ToolDefinition>();
const MANIFEST_BY_ID = new Map(TOOL_MANIFEST.map((tool) => [tool.id, tool]));
const MANIFEST_BY_PATH = new Map<string, ToolManifestEntry>();
for (const tool of TOOL_REGISTRY) {
  TOOL_BY_PATH.set(tool.path, tool);
  for (const alias of tool.aliases) TOOL_BY_PATH.set(alias, tool);
}
for (const tool of TOOL_MANIFEST) {
  MANIFEST_BY_PATH.set(tool.path, tool);
  for (const alias of tool.aliases) MANIFEST_BY_PATH.set(alias, tool);
}

export function getToolDefinition(id: string): ToolDefinition | undefined {
  return TOOL_BY_ID.get(id);
}

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOL_BY_ID.get(id);
}

export function getToolByRoute(path: string): ToolDefinition | undefined {
  return TOOL_BY_PATH.get(path);
}

export function getToolManifest(id: string): ToolManifestEntry | undefined {
  return MANIFEST_BY_ID.get(id);
}

export function getToolManifestByPath(path: string): ToolManifestEntry | undefined {
  return MANIFEST_BY_PATH.get(path);
}

export function getToolsByFamily(family: ToolFamily): readonly ToolManifestEntry[] {
  return TOOL_MANIFEST.filter((tool) => tool.family === family);
}
