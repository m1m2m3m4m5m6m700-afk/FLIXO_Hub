import { applyBasicImageEffect, convertImage, cropResizeImage, flipImage, hueShiftImage, imageInfo, padImage, pixelateImage, removeBackground, resizeImage, rotateImage } from '../tools/image-toolkit/engine';

export type ChainInput = Readonly<{ blob: Blob; fileName: string }>;
export type ChainOutput = Readonly<{ blob: Blob; fileName: string }>;
export type ToolChainAdapter = (input: ChainInput) => Promise<ChainOutput>;
type ToolChainAdapterDefinition = Readonly<{ execute: ToolChainAdapter }>;
const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'flixo-output';

export const TOOL_CHAIN_ADAPTERS: Readonly<Record<string, ToolChainAdapterDefinition>> = Object.freeze({
  'image-converter': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await convertImage(blob, 'image/webp'), fileName: baseName(fileName) + '.webp' }) }),
  'image-upscaler': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await resizeImage(blob, 2), fileName: baseName(fileName) + '-2x.png' }) }),
  'background-remover': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await removeBackground(blob, 42), fileName: baseName(fileName) + '-no-background.png' }) }),
  'image-cropper': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => { const info = await imageInfo(blob); const size = Math.min(info.width, info.height); return { blob: await cropResizeImage(blob, { x: Math.floor((info.width - size) / 2), y: Math.floor((info.height - size) / 2), width: size, height: size }, { width: size, height: size }), fileName: baseName(fileName) + '-square.png' }; } }),
  'image-compressor': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await convertImage(blob, 'image/webp'), fileName: baseName(fileName) + '-compressed.webp' }) }),
  'image-effects': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await applyBasicImageEffect(blob, 'contrast', 115), fileName: baseName(fileName) + '-effects.png' }) }),
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
  'image-resizer': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await resizeImage(blob, 1.5), fileName: baseName(fileName) + '-resized.png' }) }),
  'image-hue': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await hueShiftImage(blob, 30), fileName: baseName(fileName) + '-hue.png' }) }),
  'image-pixelate': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await pixelateImage(blob, 10), fileName: baseName(fileName) + '-pixelated.png' }) }),
  'image-padding': Object.freeze({ execute: async ({ blob, fileName }: ChainInput) => ({ blob: await padImage(blob, 24), fileName: baseName(fileName) + '-padded.png' }) }),
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
