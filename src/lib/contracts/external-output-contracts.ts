import type { ToolOutputContract } from './tool-output.ts';

export const AI_IMAGE_GENERATOR_OUTPUT_CONTRACT: ToolOutputContract = Object.freeze({
  toolId: 'ai-image-generator',
  variants: [
    {
      kind: 'image',
      outputMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      allowedExtensions: ['png', 'jpg', 'jpeg', 'webp'],
      signatures: ['89504e470d0a1a0a', 'ffd8ff', '52494646'],
      compoundSignatures: [{ offset: 8, signature: '57454250', mimeTypes: ['image/webp'] }],
      downloadRequired: true,
      minOutputBytes: 1,
      maxOutputBytes: 50 * 1024 * 1024,
      maxPixels: 100_000_000,
      validateDimensions: true,
    },
  ],
});
