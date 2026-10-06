import { MVP_EXECUTABLE_TOOL_IDS, type CanonicalCapabilityParameters } from '../config/manual-capability-definition';
import { executeCanonicalTool } from './execution/canonical-executor';

export type ChainInput = Readonly<{ blob: Blob; fileName: string }>;
export type ChainOutput = Readonly<{ blob: Blob; fileName: string }>;
export type ToolChainAdapter = (
  input: ChainInput,
  parameters?: CanonicalCapabilityParameters,
) => Promise<ChainOutput>;

const MVP_CHAIN_IDS = new Set<string>(MVP_EXECUTABLE_TOOL_IDS);

function defaultParameters(toolId: string): CanonicalCapabilityParameters {
  switch (toolId) {
    case 'background-remover':
      return { tolerance: 42 };
    case 'image-upscaler':
      return { scale: 2 };
    case 'image-compressor':
      return { format: 'image/webp', quality: 0.82 };
    case 'image-converter':
      return { format: 'image/webp' };
    case 'image-effects':
      return { brightness: 100, contrast: 115, saturate: 100 };
    case 'video-cropper':
      return { x: 0, y: 0, width: 1280, height: 720 };
    case 'video-resizer':
      return { width: 1280, height: 720 };
    case 'video-compressor':
      return { videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 };
    default:
      return {};
  }
}

export const getToolChainAdapter = (toolId: string): ToolChainAdapter | undefined =>
  MVP_CHAIN_IDS.has(toolId)
    ? (input, parameters) =>
        executeCanonicalTool(toolId, input, parameters ?? defaultParameters(toolId))
    : undefined;

export async function executeToolChain(
  steps: readonly string[],
  input: ChainInput,
  onStep?: (completed: number, total: number, toolId: string) => void,
): Promise<ChainOutput> {
  if (steps.length < 1 || steps.length > 4) {
    throw new Error('Tool chain is bounded to 1-4 canonical MVP steps.');
  }

  let current = input;
  for (let index = 0; index < steps.length; index += 1) {
    const toolId = steps[index];
    const adapter = getToolChainAdapter(toolId);
    if (!adapter) {
      throw new Error('Tool "' + toolId + '" is outside the canonical MVP execution surface.');
    }
    onStep?.(index, steps.length, toolId);
    current = await adapter(current);
  }
  return current;
}
