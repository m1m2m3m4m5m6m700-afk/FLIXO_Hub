import { applyBasicImageEffect, convertImage, cropResizeImage, flipImage, imageInfo, removeBackground, resizeImage, rotateImage } from '../tools/image-toolkit/engine';
import { compressImage } from '../tools/image-compressor/engine';
import { getVideoToolExecutor } from './video/video-tool-executors';

export type ChainInput = Readonly<{ blob: Blob; fileName: string; parameters?: Readonly<Record<string, string | number | boolean>> }>;
export type ChainOutput = Readonly<{ blob: Blob; fileName: string }>;
export type ToolChainAdapter = (input: ChainInput) => Promise<ChainOutput>;
type ToolChainAdapterDefinition = Readonly<{ execute: ToolChainAdapter }>;
type CapabilityParameters = Readonly<Record<string, string | number | boolean>>;
const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'flixo-output';
const numberOr = (value: unknown, fallback: number): number => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const TOOL_CHAIN_ADAPTERS: Readonly<Record<string, ToolChainAdapterDefinition>> = Object.freeze({
  'background-remover': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await removeBackground(blob, 42), fileName: baseName(fileName) + '-no-background.png' }) }),
  'image-upscaler': Object.freeze({ execute: async ({ blob, fileName, parameters }: ChainInput) => ({ blob: await resizeImage(blob, Math.min(8, Math.max(1, numberOr(parameters?.scale, 2)))), fileName: baseName(fileName) + '-upscaled.png' }) }),
  'image-cropper': Object.freeze({ execute: async ({ blob, fileName, parameters }: ChainInput) => {
    const info = await imageInfo(blob);
    const cropWidth = Math.min(info.width, Math.max(1, Math.round(numberOr(parameters?.cropWidth, info.width))));
    const cropHeight = Math.min(info.height, Math.max(1, Math.round(numberOr(parameters?.cropHeight, info.height))));
    const width = Math.min(4000, Math.max(1, Math.round(numberOr(parameters?.width, cropWidth))));
    const height = Math.min(4000, Math.max(1, Math.round(numberOr(parameters?.height, cropHeight))));
    const x = Math.min(Math.max(0, info.width - cropWidth), Math.max(0, Math.round(numberOr(parameters?.x, 0))));
    const y = Math.min(Math.max(0, info.height - cropHeight), Math.max(0, Math.round(numberOr(parameters?.y, 0))));
    return { blob: await cropResizeImage(blob, { x, y, width: cropWidth, height: cropHeight }, { width, height }), fileName: baseName(fileName) + '-cropped.png' };
  }}),
  'image-compressor': Object.freeze({ execute: async ({ blob, fileName, parameters }: ChainInput) => {
    const format = parameters?.format === 'image/jpeg' || parameters?.format === 'image/png' ? parameters.format : 'image/webp';
    const file = new File([blob], fileName, { type: blob.type || 'image/png' });
    const result = await compressImage(file, {
      quality: Math.min(1, Math.max(0.05, numberOr(parameters?.quality, 0.82))),
      format,
      maxWidth: parameters?.maxWidth === undefined ? undefined : Math.min(4000, Math.max(1, Math.round(numberOr(parameters.maxWidth, 4000)))),
      maxHeight: parameters?.maxHeight === undefined ? undefined : Math.min(4000, Math.max(1, Math.round(numberOr(parameters.maxHeight, 4000)))),
      targetSizeKB: parameters?.targetSizeKB === undefined ? undefined : Math.min(64 * 1024, Math.max(1, Math.round(numberOr(parameters.targetSizeKB, 1024)))),
    });
    return { blob: result.blob, fileName: baseName(fileName) + '-compressed.' + (format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp') };
  }}),
  'image-converter': Object.freeze({ execute: async ({ blob, fileName, parameters }: ChainInput) => {
    const format = parameters?.format === 'image/jpeg' || parameters?.format === 'image/png' ? parameters.format : 'image/webp';
    return { blob: await convertImage(blob, format), fileName: baseName(fileName) + '.' + (format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp') };
  }}),
  'image-effects': Object.freeze({ execute: async ({ blob, fileName, parameters }: ChainInput) => {
    let current = blob;
    const effects: Array<['brightness' | 'contrast' | 'saturation' | 'grayscale', number]> = [
      ['brightness', numberOr(parameters?.brightness, 100)],
      ['contrast', numberOr(parameters?.contrast, 100)],
      ['saturation', numberOr(parameters?.saturate, 100)],
      ['grayscale', numberOr(parameters?.grayscale, 0)],
    ];
    for (const [effect, value] of effects) {
      const neutral = effect === 'grayscale' ? 0 : 100;
      if (value !== neutral) current = await applyBasicImageEffect(current, effect, value);
    }
    return { blob: current, fileName: baseName(fileName) + '-effects.png' };
  }}),
  'video-trimmer': Object.freeze({ execute: async ({ blob, fileName, parameters }: ChainInput) => {
    const executor = getVideoToolExecutor({ id: 'video-trimmer' });
    if (!executor) throw new Error('video-trimmer has no canonical video executor');
    return { blob: await executor(blob, (parameters ?? {}) as CapabilityParameters, { id: 'video-trimmer' }), fileName: baseName(fileName) + '-trimmed.webm' };
  }}),
  'video-cropper': Object.freeze({ execute: async ({ blob, fileName, parameters }: ChainInput) => {
    const executor = getVideoToolExecutor({ id: 'video-cropper' });
    if (!executor) throw new Error('video-cropper has no canonical video executor');
    return { blob: await executor(blob, (parameters ?? {}) as CapabilityParameters, { id: 'video-cropper' }), fileName: baseName(fileName) + '-cropped.webm' };
  }}),
  'video-resizer': Object.freeze({ execute: async ({ blob, fileName, parameters }: ChainInput) => {
    const executor = getVideoToolExecutor({ id: 'video-resizer' });
    if (!executor) throw new Error('video-resizer has no canonical video executor');
    return { blob: await executor(blob, (parameters ?? {}) as CapabilityParameters, { id: 'video-resizer' }), fileName: baseName(fileName) + '-resized.webm' };
  }}),
  'video-compressor': Object.freeze({ execute: async ({ blob, fileName, parameters }: ChainInput) => {
    const executor = getVideoToolExecutor({ id: 'video-compressor' });
    if (!executor) throw new Error('video-compressor has no canonical video executor');
    return { blob: await executor(blob, (parameters ?? {}) as CapabilityParameters, { id: 'video-compressor' }), fileName: baseName(fileName) + '-compressed.webm' };
  }}),
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
});

export const getToolChainAdapter = (toolId: string): ToolChainAdapter | undefined => TOOL_CHAIN_ADAPTERS[toolId]?.execute;

export async function executeToolChain(
  steps: readonly string[],
  input: ChainInput,
  onStep?: (completed: number, total: number, toolId: string) => void,
): Promise<ChainOutput> {
  let current = input;
  for (let index = 0; index < steps.length; index += 1) {
    const toolId = steps[index];
    const definition = TOOL_CHAIN_ADAPTERS[toolId];
    if (!definition) throw new Error('Tool "' + toolId + '" has no local chain adapter yet.');
    onStep?.(index, steps.length, toolId);
    current = await definition.execute(current);
  }
  return current;
}
