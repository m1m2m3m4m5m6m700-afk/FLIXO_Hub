import { executeCanonicalChain } from './execution/canonical-executor';
import type { ChainInput, ChainOutput } from './tool-chain-adapters';
import { validateToolChain } from './tool-chain-compatibility';

export async function runStoredToolChain(
  steps: readonly string[],
  input: ChainInput,
  onStep?: (completed: number, total: number, toolId: string) => void,
): Promise<ChainOutput> {
  const validation = validateToolChain(steps, input);
  if (!validation.valid) throw new Error(validation.reason ?? 'Tool chain is not compatible.');
  return executeCanonicalChain(
    steps.map((toolId) => ({ toolId })),
    input,
    onStep,
  );
}
