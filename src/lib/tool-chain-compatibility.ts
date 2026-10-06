import { MVP_EXECUTABLE_TOOL_IDS } from '../config/manual-capability-definition';

type ChainContract = Readonly<{
  inputMime: readonly string[];
  outputMime: readonly string[];
}>;

const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
const VIDEO_MIME = ['video/webm'] as const;

function contractFor(toolId: string): ChainContract {
  if (toolId.startsWith('video-')) {
    return { inputMime: VIDEO_MIME, outputMime: ['video/webm'] };
  }
  if (toolId === 'image-converter') {
    return { inputMime: IMAGE_MIME, outputMime: ['image/webp', 'image/png', 'image/jpeg'] };
  }
  return { inputMime: IMAGE_MIME, outputMime: ['image/png'] };
}

export const TOOL_CHAIN_CONTRACTS: Readonly<Record<string, ChainContract>> = Object.freeze(
  Object.fromEntries(MVP_EXECUTABLE_TOOL_IDS.map((toolId) => [toolId, contractFor(toolId)])),
);

const supportsMime = (supported: readonly string[], mime: string) =>
  supported.includes(mime) || supported.includes('*/*');

export type ToolChainValidation = Readonly<{
  valid: boolean;
  reason?: string;
}>;

export function validateToolChainContracts(
  steps: readonly string[],
  inputMime: string,
): ToolChainValidation {
  if (steps.length === 0) return { valid: false, reason: 'Tool chain is empty.' };
  if (steps.length > 4) return { valid: false, reason: 'Tool chain is bounded to 1-4 canonical MVP steps.' };

  let mime = inputMime || 'application/octet-stream';
  for (const toolId of steps) {
    if (!MVP_EXECUTABLE_TOOL_IDS.includes(toolId as (typeof MVP_EXECUTABLE_TOOL_IDS)[number])) {
      return { valid: false, reason: `Tool "${toolId}" is outside the canonical MVP execution surface.` };
    }

    const contract = TOOL_CHAIN_CONTRACTS[toolId];
    if (!contract) return { valid: false, reason: `Tool "${toolId}" has no canonical chain contract.` };
    if (!supportsMime(contract.inputMime, mime)) {
      return { valid: false, reason: `Tool "${toolId}" cannot accept ${mime}.` };
    }
    mime = contract.outputMime[0] ?? 'application/octet-stream';
  }

  return { valid: true };
}

export function validateToolChain(
  steps: readonly string[],
  input: { blob: Blob },
): ToolChainValidation {
  return validateToolChainContracts(steps, input.blob.type);
}
