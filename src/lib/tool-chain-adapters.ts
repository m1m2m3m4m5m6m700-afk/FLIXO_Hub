import { applyBasicImageEffect, flipImage, hueShiftImage, padImage, pixelateImage, resizeImage, rotateImage } from '../tools/image-toolkit/engine';
import { executeCanonicalImageTool } from './canonical-image-executor';

export type ChainInput = Readonly<{ blob: Blob; fileName: string }>;
export type ChainOutput = Readonly<{ blob: Blob; fileName: string }>;
export type ChainParameters = Readonly<Record<string, string | number | boolean>>;
export type ToolChainStep = Readonly<{ toolId: string; params?: ChainParameters }>;
export type ToolChainAdapter = (input: ChainInput, parameters?: ChainParameters) => Promise<ChainOutput>;
type ToolChainAdapterDefinition = Readonly<{ execute: ToolChainAdapter }>;
const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'flixo-output';

const numberParam = (parameters: ChainParameters | undefined, key: string, fallback: number): number => {
  const value = parameters?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const stringParam = (parameters: ChainParameters | undefined, key: string, fallback: string): string => {
  const value = parameters?.[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

const executeCanonicalChainTool = async (toolId: string, blob: Blob, parameters: ChainParameters): Promise<Blob> => {
  const receipt = await executeCanonicalImageTool({ toolId, inputBlob: blob, parameters, origin: 'manual' });
  return receipt.outputBlob;
};

export const TOOL_CHAIN_ADAPTERS: Readonly<Record<string, ToolChainAdapterDefinition>> = Object.freeze({
  'image-converter': Object.freeze({ execute: async ({ blob, fileName }: ChainInput, parameters?: ChainParameters) => {
    const format = stringParam(parameters, 'format', 'image/webp') as 'image/png' | 'image/jpeg' | 'image/webp';
    return { blob: await executeCanonicalChainTool('image-converter', blob, { format }), fileName: baseName(fileName) + (format === 'image/jpeg' ? '.jpg' : format === 'image/png' ? '.png' : '.webp') };
  } }),
  'image-upscaler': Object.freeze({ execute: async ({ blob, fileName }: ChainInput, parameters?: ChainParameters) => {
    const scale = numberParam(parameters, 'scale', 2);
    return { blob: await executeCanonicalChainTool('image-upscaler', blob, { scale }), fileName: baseName(fileName) + `-${scale}x.png` };
  } }),
  'background-remover': Object.freeze({ execute: async ({ blob, fileName }: ChainInput, parameters?: ChainParameters) => ({ blob: await executeCanonicalChainTool('background-remover', blob, { tolerance: numberParam(parameters, 'tolerance', 42) }), fileName: baseName(fileName) + '-no-background.png' }) }),
  'image-cropper': Object.freeze({ execute: async ({ blob, fileName }: ChainInput, parameters?: ChainParameters) => ({ blob: await executeCanonicalChainTool('image-cropper', blob, { aspectRatio: stringParam(parameters, 'aspectRatio', '1:1') }), fileName: baseName(fileName) + '-cropped.png' }) }),
  'image-compressor': Object.freeze({ execute: async ({ blob, fileName }: ChainInput, parameters?: ChainParameters) => {
    const format = stringParam(parameters, 'format', 'image/webp') as 'image/png' | 'image/jpeg' | 'image/webp';
    const quality = numberParam(parameters, 'quality', 0.8);
    const targetSizeKB = parameters?.targetSizeKB;
    const maxWidth = parameters?.maxWidth;
    const maxHeight = parameters?.maxHeight;
    const result = await executeCanonicalChainTool('image-compressor', blob, { format, quality, ...(typeof targetSizeKB === 'number' ? { targetSizeKB } : {}), ...(typeof maxWidth === 'number' ? { maxWidth } : {}), ...(typeof maxHeight === 'number' ? { maxHeight } : {}) });
    return { blob: result, fileName: baseName(fileName) + '-compressed' + (format === 'image/jpeg' ? '.jpg' : format === 'image/png' ? '.png' : '.webp') };
  } }),
  'image-effects': Object.freeze({ execute: async ({ blob, fileName }: ChainInput, parameters?: ChainParameters) => {
    const brightness = numberParam(parameters, 'brightness', 100);
    const contrast = numberParam(parameters, 'contrast', 100);
    const saturation = numberParam(parameters, 'saturate', 100);
    const grayscale = numberParam(parameters, 'grayscale', 0);
    const effectParameters: ChainParameters = brightness !== 100 ? { brightness } : contrast !== 100 ? { contrast } : saturation !== 100 ? { saturate: saturation } : grayscale !== 0 ? { grayscale } : { contrast: 115 };
    const result = await executeCanonicalChainTool('image-effects', blob, effectParameters);
    return { blob: result, fileName: baseName(fileName) + '-effects.png' };
  } }),
  'image-rotate': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await rotateImage(blob, 90), fileName: baseName(fileName) + '-rotated.png' }) }),
  'image-flip-horizontal': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await flipImage(blob, true), fileName: baseName(fileName) + '-flipped-h.png' }) }),
  'image-flip-vertical': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await flipImage(blob, false), fileName: baseName(fileName) + '-flipped-v.png' }) }),
  'image-brightness': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'brightness', 115), fileName: baseName(fileName) + '-brightness.png' }) }),
  'image-contrast': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'contrast', 115), fileName: baseName(fileName) + '-contrast.png' }) }),
  'image-saturation': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'saturation', 115), fileName: baseName(fileName) + '-saturation.png' }) }),
  'image-grayscale': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'grayscale', 100), fileName: baseName(fileName) + '-grayscale.png' }) }),
  'image-invert': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'invert', 100), fileName: baseName(fileName) + '-invert.png' }) }),
  'image-sepia': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'sepia', 100), fileName: baseName(fileName) + '-sepia.png' }) }),
  'image-blur': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'blur', 80), fileName: baseName(fileName) + '-blur.png' }) }),
  'image-sharpen': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'sharpen', 110), fileName: baseName(fileName) + '-sharpen.png' }) }),
  'image-resizer': Object.freeze({ execute: async ({ blob, fileName }: ChainInput, parameters?: ChainParameters) => {
    const scale = numberParam(parameters, 'scale', 1.5);
    return { blob: await resizeImage(blob, scale), fileName: baseName(fileName) + `-resized-${scale}x.png` };
  } }),
  'image-hue': Object.freeze({ execute: async ({ blob, fileName }: ChainInput, parameters?: ChainParameters) => ({ blob: await hueShiftImage(blob, numberParam(parameters, 'degrees', 30)), fileName: baseName(fileName) + '-hue.png' }) }),
  'image-pixelate': Object.freeze({ execute: async ({ blob, fileName }: ChainInput, parameters?: ChainParameters) => ({ blob: await pixelateImage(blob, numberParam(parameters, 'blockSize', 10)), fileName: baseName(fileName) + '-pixelated.png' }) }),
  'image-padding': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await padImage(blob, 24), fileName: baseName(fileName) + '-padded.png' }) }),
});

export const getToolChainAdapter = (toolId: string): ToolChainAdapter | undefined => TOOL_CHAIN_ADAPTERS[toolId]?.execute;

export async function executeToolChain(
  steps: readonly (string | ToolChainStep)[],
  input: ChainInput,
  onStep?: (completed: number, total: number, toolId: string) => void,
): Promise<ChainOutput> {
  let current = input;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const toolId = typeof step === 'string' ? step : step.toolId;
    const parameters = typeof step === 'string' ? undefined : step.params;
    const definition = TOOL_CHAIN_ADAPTERS[toolId];
    if (!definition) throw new Error('Tool "' + toolId + '" has no local chain adapter yet.');
    onStep?.(index, steps.length, toolId);
    current = await definition.execute(current, parameters);
  }
  return current;
}
