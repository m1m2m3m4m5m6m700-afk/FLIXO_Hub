import { getCapability, MVP_EXECUTABLE_TOOL_IDS, validateCapabilityParameters } from '../config/manual-capability-definition';
import { TOOL_CATALOG } from '../config/registry';
import { executeToolChain, type ChainInput, type ChainOutput } from './tool-chain-adapters';
import { parseExecutionPlan, type ExecutionPlanContract } from './contracts/ai-plan';

export type AgentPlan = Readonly<ExecutionPlanContract & {
  requiresUserConfirmation: true;
  matchedIntent: string;
}>;

const MAX_AGENT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_PROMPT_CHARS = 2_000;

const DEFAULT_PARAMS: Readonly<Record<string, Record<string, string | number | boolean>>> = Object.freeze({
  'image-cropper': { aspectRatio: '1:1' },
  'image-converter': { format: 'image/webp' },
  'image-compressor': { format: 'image/webp' },
  'image-effects': { contrast: 115 },
  'image-resizer': { scale: 1.5 },
  'image-hue': { degrees: 30 },
  'image-pixelate': { blockSize: 10 },
});

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function assertLocalImageFile(file: File): void {
  if (file.size <= 0 || file.size > MAX_AGENT_FILE_BYTES) {
    throw new Error('File rejected: size must be between 1 byte and 25 MB.');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Agent Guided Workflow accepts image files only.');
  }
}

const EN_STOPWORDS = new Set(['a', 'an', 'the', 'this', 'my', 'to', 'of', 'for', 'please', 'do', 'on', 'with']);

function tokenize(value: string): string[] {
  return normalize(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !EN_STOPWORDS.has(token));
}

function scoreIntent(prompt: string, intent: string, toolId: string): number {
  const promptTokens = tokenize(prompt);
  const intentTokens = tokenize(intent);
  if (!promptTokens.length || !intentTokens.length) return 0;
  if (!intentTokens.every((token) => promptTokens.includes(token))) return 0;
  const exactBonus = normalize(prompt).includes(normalize(intent)) ? 4 : 0;
  const specificityBonus = toolId === 'image-effects' ? -0.5 : 0;
  return intent.length + exactBonus + specificityBonus;
}

function findIntent(prompt: string): { toolId: string; intent: string } {
  const candidates: Array<{ toolId: string; intent: string; score: number }> = [];
  for (const toolId of MVP_EXECUTABLE_TOOL_IDS) {
    const capability = getCapability(toolId);
    if (!capability || capability.state !== 'EXECUTABLE') {
      throw new Error('Agent capability boundary rejected an unadmitted tool.');
    }
    for (const intent of capability.intents) {
      const score = scoreIntent(prompt, intent, toolId);
      if (score > 0) candidates.push({ toolId, intent, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.toolId.localeCompare(b.toolId));
  const winner = candidates[0];
  if (!winner) throw new Error('No admitted FLIXO capability matches this request.');
  if (candidates[1] && candidates[1].score === winner.score && candidates[1].toolId !== winner.toolId) {
    throw new Error('Request is ambiguous. Choose one supported image operation.');
  }
  return { toolId: winner.toolId, intent: winner.intent };
}

function parametersFor(toolId: string): Record<string, string | number | boolean> {
  const params = DEFAULT_PARAMS[toolId] ? { ...DEFAULT_PARAMS[toolId] } : {};
  validateCapabilityParameters(toolId, params);
  return params;
}

export function planAgentRequest(prompt: string, file: File): AgentPlan {
  assertLocalImageFile(file);
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length > MAX_PROMPT_CHARS) {
    throw new Error('Prompt must contain between 1 and 2,000 characters.');
  }

  const matched = findIntent(trimmed);
  const params = parametersFor(matched.toolId);
  const plan = parseExecutionPlan({
    workflowName: `FLIXO Agent — ${matched.toolId}`,
    confidence: Math.min(0.99, 0.75 + Math.min(0.24, matched.intent.length / 200)),
    catalogFingerprint: TOOL_CATALOG.fingerprint,
    steps: [{ toolId: matched.toolId, params }],
  });

  return Object.freeze({
    ...plan,
    requiresUserConfirmation: true as const,
    matchedIntent: matched.intent,
  });
}

export async function executeAgentPlan(
  plan: AgentPlan,
  file: File,
  confirmed: boolean,
): Promise<ChainOutput> {
  assertLocalImageFile(file);
  if (!confirmed || plan.requiresUserConfirmation !== true) {
    throw new Error('Execution denied: explicit user confirmation is required.');
  }

  const steps = plan.steps.map((step) => step.toolId);
  if (steps.length !== 1) throw new Error('Agent execution is bounded to one local tool step.');

  const capability = getCapability(steps[0]);
  if (!capability || capability.state !== 'EXECUTABLE' || capability.requirements.network) {
    throw new Error('Execution denied by the canonical capability boundary.');
  }
  const input: ChainInput = Object.freeze({ blob: file, fileName: file.name });
  const output = await executeToolChain(steps, input);
  const verified = await capability.verifier(file, output.blob, (plan.steps[0].params ?? {}) as Record<string, string | number | boolean>);
  if (!verified) {
    throw new Error('Execution failed closed: output verifier rejected the artifact.');
  }
  return output;
}
