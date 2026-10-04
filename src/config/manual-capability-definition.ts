import { z, type ZodType } from "zod";

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

export type CanonicalCapabilitySafetyContract = Readonly<{
  requiresUserConfirmationForAgent: boolean;
  allowLockedLayerSelection: false;
  rawBlobEgress: false;
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
  recovery: Readonly<{ maxAttempts: number; replanOnFailure: false }>;
  safetyContract: CanonicalCapabilitySafetyContract;
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
  "image-resizer": z.object({ scale: z.number().finite().positive().min(0.1).max(8).optional(), width: z.number().int().positive().max(4000).optional(), height: z.number().int().positive().max(4000).optional() }).strict().refine(v => v.scale !== undefined || v.width !== undefined || v.height !== undefined, "resize parameters are required"),
  "image-rotate-flip": z.object({ rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(90), flipX: z.boolean().default(false), flipY: z.boolean().default(false) }).strict(),
  "image-brightness-contrast": z.object({ brightness: z.number().finite().min(0).max(200).optional(), contrast: z.number().finite().min(0).max(200).optional() }).strict().refine(v => v.brightness !== undefined || v.contrast !== undefined, "brightness or contrast is required").refine(v => (v.brightness ?? 100) !== 100 || (v.contrast ?? 100) !== 100, "brightness or contrast must change"),
  "image-saturation-hue": z.object({ saturation: z.number().finite().min(0).max(200).optional(), hue: z.number().finite().min(-360).max(360).optional() }).strict().refine(v => v.saturation !== undefined || v.hue !== undefined, "saturation or hue is required").refine(v => (v.saturation ?? 100) !== 100 || (v.hue ?? 0) !== 0, "saturation or hue must change"),
  "image-exposure": z.object({ exposure: z.number().finite().min(-4).max(4).refine(v => v !== 0, "exposure cannot be neutral") }).strict(),
  "image-highlights-shadows": z.object({ highlights: z.number().finite().min(-100).max(100).optional(), shadows: z.number().finite().min(-100).max(100).optional() }).strict().refine(v => (v.highlights ?? 0) !== 0 || (v.shadows ?? 0) !== 0, "highlights or shadows must change"),
  "image-sharpen": z.object({ amount: z.number().finite().min(1).max(200).default(110) }).strict(),
  "image-blur": z.object({ radius: z.number().finite().min(1).max(32).default(6) }).strict(),
  "image-grayscale-duotone": z.object({ intensity: z.number().finite().min(1).max(100).default(100), darkColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#111111"), lightColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f5f5f5") }).strict(),
  "image-filters": z.object({ preset: z.enum(["vivid","warm","cool","vintage","mono","sepia","cinematic"]) }).strict(),
  "image-watermark": z.object({ text: z.string().trim().min(1).max(200), x: z.number().finite().min(0).max(100).default(10), y: z.number().finite().min(0).max(100).default(90), fontSize: z.number().int().min(8).max(240).default(32), opacity: z.number().finite().min(0.05).max(1).default(0.65), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff") }).strict(),
  "image-text-overlay": z.object({ text: z.string().trim().min(1).max(500), x: z.number().finite().min(0).max(100).default(50), y: z.number().finite().min(0).max(100).default(50), fontSize: z.number().int().min(8).max(240).default(48), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"), background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), backgroundOpacity: z.number().finite().min(0).max(1).default(0.5), align: z.enum(["left","center","right"]).default("center") }).strict(),
  "image-draw-annotate": z.object({ kind: z.enum(["line","arrow","rect","ellipse"]).default("arrow"), x1: z.number().finite().min(0).max(100).default(10), y1: z.number().finite().min(0).max(100).default(10), x2: z.number().finite().min(0).max(100).default(80), y2: z.number().finite().min(0).max(100).default(80), stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ff3b30"), strokeWidth: z.number().int().min(1).max(40).default(8) }).strict(),
  "image-redaction": z.object({ x: z.number().finite().min(0).max(100).default(25), y: z.number().finite().min(0).max(100).default(25), width: z.number().finite().min(1).max(100).default(50), height: z.number().finite().min(1).max(100).default(25), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#000000") }).strict(),
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

export const MVP_EXECUTABLE_TOOL_IDS = Object.freeze(["background-remover","image-upscaler","image-cropper","image-compressor","image-converter","image-effects","image-resizer","image-rotate-flip","image-brightness-contrast","image-saturation-hue","image-exposure","image-highlights-shadows","image-sharpen","image-blur","image-grayscale-duotone","image-filters","image-watermark","image-text-overlay","image-draw-annotate","image-redaction","video-trimmer","video-cropper","video-resizer","video-compressor"] as const);

const INTENTS: Record<string, readonly string[]> = {
  "background-remover": ["remove background","transparent background","cut out background","background removal","إزالة الخلفية","خلفية شفافة"],
  "image-upscaler": ["upscale","sharper","higher quality","increase resolution","make it clearer","رفع الجودة","زيادة الدقة"],
  "image-cropper": ["crop","resize","dimensions","aspect ratio","قص الصورة","تغيير الحجم"],
  "image-compressor": ["compress","smaller","reduce size","file size","lighter","ضغط الصور","تصغير حجم الصورة"],
  "image-converter": ["convert format","jpg to png","png to jpg","webp","change format","تحويل الصيغة","تحويل الصورة"],
  "image-effects": ["adjust image effects","apply image effects","creative image effects","تأثيرات الصورة","ضبط التأثيرات"],
  "image-resizer": ["resize image","change image dimensions","resize to","تغيير حجم الصورة","تغيير أبعاد الصورة"],
  "image-rotate-flip": ["rotate and flip","rotate image","flip image","تدوير وقلب الصورة","تدوير الصورة","قلب الصورة"],
  "image-brightness-contrast": ["brightness contrast","adjust brightness and contrast","سطوع وتباين","ضبط السطوع والتباين"],
  "image-saturation-hue": ["saturation hue","adjust saturation and hue","التشبع ودرجة اللون","ضبط التشبع ودرجة اللون"],
  "image-exposure": ["exposure","adjust exposure","تعريض الصورة","ضبط التعريض"],
  "image-highlights-shadows": ["highlights shadows","highlights and shadows","الإبرازات والظلال","ضبط الإبرازات والظلال"],
  "image-sharpen": ["sharpen image","increase sharpness","حدة الصورة","زيادة حدة الصورة"],
  "image-blur": ["blur image","soften image","ضبابية الصورة","تمويه الصورة"],
  "image-grayscale-duotone": ["grayscale duotone","duotone","تدرج رمادي","دوتون"],
  "image-filters": ["photo filters","image filter preset","فلاتر الصور","فلتر الصورة"],
  "image-watermark": ["add watermark","watermark text","إضافة علامة مائية","علامة مائية"],
  "image-text-overlay": ["add text to image","text overlay","كتابة على الصورة","إضافة نص للصورة"],
  "image-draw-annotate": ["draw on image","annotate image","arrow annotation","الرسم على الصورة","التعليق على الصورة"],
  "image-redaction": ["redact image","censor image","hide sensitive region","تعمية الصورة","طمس بيانات حساسة"],
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
  "image-resizer": {title:"Image Resizer",description:"Resize images to exact dimensions or a bounded scale.",category:"Images",family:"image"},
  "image-rotate-flip": {title:"Rotate & Flip",description:"Rotate and flip images locally.",category:"Images",family:"image"},
  "image-brightness-contrast": {title:"Brightness & Contrast",description:"Adjust brightness and contrast locally.",category:"Images",family:"image"},
  "image-saturation-hue": {title:"Saturation & Hue",description:"Adjust saturation and hue locally.",category:"Images",family:"image"},
  "image-exposure": {title:"Exposure",description:"Adjust image exposure locally.",category:"Images",family:"image"},
  "image-highlights-shadows": {title:"Highlights & Shadows",description:"Adjust image highlights and shadows locally.",category:"Images",family:"image"},
  "image-sharpen": {title:"Sharpen",description:"Sharpen image detail locally.",category:"Images",family:"image"},
  "image-blur": {title:"Blur",description:"Blur image detail locally.",category:"Images",family:"image"},
  "image-grayscale-duotone": {title:"Grayscale & Duotone",description:"Apply grayscale and duotone mapping locally.",category:"Images",family:"image"},
  "image-filters": {title:"Image Filters",description:"Apply deterministic local image filter presets.",category:"Images",family:"image"},
  "image-watermark": {title:"Watermark",description:"Add a local text watermark.",category:"Images",family:"image"},
  "image-text-overlay": {title:"Text Overlay",description:"Place text over an image locally.",category:"Images",family:"image"},
  "image-draw-annotate": {title:"Draw & Annotate",description:"Draw local annotations on an image.",category:"Images",family:"image"},
  "image-redaction": {title:"Image Redaction",description:"Permanently cover a selected image region locally.",category:"Images",family:"image"},
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
  if (!inputDimensions || !outputDimensions) return false;
  return inputDimensions.width === outputDimensions.width && inputDimensions.height === outputDimensions.height;
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
  const inputDimensions = await readImageDimensions(input, signal);
  const outputDimensions = await readImageDimensions(output, signal);
  if (!inputDimensions || !outputDimensions) return false;
  return outputDimensions.width > 0 && outputDimensions.height > 0;
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


const imageArtifactVerifier: CanonicalCapabilityVerifier = async (input, output, _parameters, signal) => {
  if (signal?.aborted || output.size <= 0 || !output.type.startsWith("image/")) return false;
  const [inputDimensions, outputDimensions] = await Promise.all([readImageDimensions(input, signal), readImageDimensions(output, signal)]);
  if (!inputDimensions || !outputDimensions || outputDimensions.width <= 0 || outputDimensions.height <= 0) return false;
  return hasMeaningfulPixelChange(input, output, signal);
};

const resizerVerifier: CanonicalCapabilityVerifier = async (input, output, parameters, signal) => {
  if (signal?.aborted || output.size <= 0 || !output.type.startsWith("image/")) return false;
  const [inputDimensions, outputDimensions] = await Promise.all([readImageDimensions(input, signal), readImageDimensions(output, signal)]);
  if (!inputDimensions || !outputDimensions) return false;
  if (parameters.width !== undefined || parameters.height !== undefined) {
    return outputDimensions.width === Number(parameters.width ?? inputDimensions.width) &&
      outputDimensions.height === Number(parameters.height ?? inputDimensions.height);
  }
  const scale = Number(parameters.scale ?? 1);
  return outputDimensions.width === Math.max(1, Math.round(inputDimensions.width * scale)) &&
    outputDimensions.height === Math.max(1, Math.round(inputDimensions.height * scale));
};

const rotateFlipVerifier: CanonicalCapabilityVerifier = async (input, output, parameters, signal) => {
  if (signal?.aborted || output.size <= 0 || !output.type.startsWith("image/")) return false;
  const a = await readImageDimensions(input, signal);
  const b = await readImageDimensions(output, signal);
  if (!a || !b) return false;
  const rotation = Number(parameters.rotation ?? 90);
  const swapped = rotation === 90 || rotation === 270;
  return b.width === (swapped ? a.height : a.width) &&
    b.height === (swapped ? a.width : a.height) &&
    hasMeaningfulPixelChange(input, output, signal);
};

const verifierForTarget = (id: string): CanonicalCapabilityVerifier => {
  switch (id) {
    case "image-resizer": return resizerVerifier;
    case "image-rotate-flip": return rotateFlipVerifier;
    case "image-brightness-contrast":
    case "image-saturation-hue":
    case "image-exposure":
    case "image-highlights-shadows":
    case "image-sharpen":
    case "image-blur":
    case "image-grayscale-duotone":
    case "image-filters":
    case "image-watermark":
    case "image-text-overlay":
    case "image-draw-annotate":
    case "image-redaction":
      return imageArtifactVerifier;
    default:
      return defaultVerifier;
  }
};

function createCapability(id:(typeof MVP_EXECUTABLE_TOOL_IDS)[number]):CanonicalCapabilityDefinition{
  const meta=META[id];
  const isVideo=id.startsWith("video-");
  const execution = "browser-local" as const;
  const safetyLimits=Object.freeze(isVideo
    ? {maxPixels:64_000_000,maxFileSizeBytes:512*1024*1024,timeoutMs:10*60*1000}
    : {maxPixels:16_000_000,maxFileSizeBytes:64*1024*1024,timeoutMs:30_000});
  const verifier =
    id==="background-remover" ? backgroundRemovalVerifier :
    id==="image-upscaler" ? upscalerVerifier :
    id==="image-cropper" ? cropperVerifier :
    id==="image-compressor" ? targetSizeVerifier :
    id==="image-converter" ? formatVerifier :
    id==="image-effects" ? effectsVerifier :
    isVideo ? videoVerifier :
    verifierForTarget(id);
  return Object.freeze({
    id,...meta,state:"EXECUTABLE" as const,executionMode:"LOCAL" as const,execution,
    intents:Object.freeze(INTENTS[id]),
    parameterSchema:PARAMETER_SCHEMAS[id],
    safetyLimits,verifier,
    requirements:Object.freeze({browser:true as const,network:false as const}),
    recovery:Object.freeze({maxAttempts:1,replanOnFailure:false as const}),
    safetyContract:Object.freeze({
      requiresUserConfirmationForAgent: !isVideo,
      allowLockedLayerSelection: false as const,
      rawBlobEgress: false as const,
    }),
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
