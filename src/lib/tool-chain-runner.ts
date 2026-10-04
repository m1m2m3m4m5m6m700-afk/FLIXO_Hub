import { getToolDefinition } from '../config/canonical-tool-definition';
import { executeToolChain, getToolChainAdapter, type ChainInput, type ChainOutput } from './tool-chain-adapters';
import { validateToolChain } from './tool-chain-compatibility';

function assertCanonicalExecutable(toolId: string): void {
  const definition = getToolDefinition(toolId);
  if (!definition) throw new Error(`Tool "${toolId}" is not registered in the canonical registry.`);
  if (definition.capability.state !== 'EXECUTABLE') {
    throw new Error(`Tool "${toolId}" is not executable in the canonical registry (state=${definition.capability.state}).`);
  }
  if (!definition.isReady || definition.executionMode !== 'LOCAL' || definition.requirements.network) {
    throw new Error(`Tool "${toolId}" violates the canonical local-execution boundary.`);
  }
  if (!definition.operational.executorId || definition.operational.executorId !== toolId) {
    throw new Error(`Tool "${toolId}" has no canonical executor binding.`);
  }
  if (!definition.operational.outputContractId) {
    throw new Error(`Tool "${toolId}" has no canonical output contract binding.`);
  }
}

export async function runStoredToolChain(
  steps: readonly string[],
  input: ChainInput,
  onStep?: (completed: number, total: number, toolId: string) => void,
): Promise<ChainOutput> {
  if (!input?.blob || !(input.blob instanceof Blob)) {
    throw new Error('Tool chain input must contain a Blob.');
  }
  if (steps.length === 0) throw new Error('Tool chain is empty.');

  for (const toolId of steps) assertCanonicalExecutable(toolId);

  const validation = validateToolChain(steps, input);
  if (!validation.valid) throw new Error(validation.reason ?? 'Tool chain is not compatible.');

  for (const toolId of steps) {
    if (!getToolChainAdapter(toolId)) throw new Error('Tool "' + toolId + '" has no local chain adapter.');
  }
  return executeToolChain(steps, input, onStep);
}
