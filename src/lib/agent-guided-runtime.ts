import { getCapability, MVP_EXECUTABLE_TOOL_IDS, validateCapabilityParameters } from '../config/manual-capability-definition';
import { TOOL_CATALOG } from '../config/registry';
import { CANONICAL_IMAGE_TOOL_IDS, createImageExecutionConfirmationToken, executeCanonicalImageTool, type CanonicalImageExecutionReceipt } from './canonical-image-executor';
import { imageInfo } from '../tools/image-toolkit/engine';
import { parseExecutionPlan, type ExecutionPlanContract } from './contracts/ai-plan';

export type AgentPlan = Readonly<ExecutionPlanContract & {
  requiresUserConfirmation: true;
  matchedIntent: string;
}>;

export type AgentConfirmationReceipt = Readonly<{
  token: string;
}>;

type ConfirmationRecord = Readonly<{
  plan: AgentPlan;
  planIdentity: string;
  file: File;
}>;

const MAX_AGENT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_PROMPT_CHARS = 2_000;
const confirmationRecords = new Map<string, ConfirmationRecord>();
const issuedPlans = new WeakMap<object, { planIdentity: string; file: File }>();

const DEFAULT_PARAMS: Readonly<Record<string, Record<string, string | number | boolean>>> = Object.freeze({
  'image-cropper': { aspectRatio: '1:1' },
  'image-converter': { format: 'image/webp' },
  'image-compressor': { format: 'image/webp', quality: 0.8 },
  'image-effects': { contrast: 115 },
  'image-resizer': { scale: 1.5 },
  'image-rotate-flip': { rotation: 90, flipX: false, flipY: false },
  'image-brightness-contrast': { brightness: 115 },
  'image-saturation-hue': { saturation: 115 },
  'image-exposure': { exposure: 1 },
  'image-highlights-shadows': { highlights: 20 },
  'image-sharpen': { amount: 110 },
  'image-blur': { radius: 6 },
  'image-grayscale-duotone': { intensity: 100 },
  'image-filters': { preset: 'vivid' },
  'image-watermark': { text: 'FLIXO' },
  'image-text-overlay': { text: 'FLIXO' },
  'image-draw-annotate': { kind: 'arrow' },
  'image-redaction': { x: 25, y: 25, width: 50, height: 25 },
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

function abortError(message: string): Error {
  if (typeof DOMException === 'function') return new DOMException(message, 'AbortError');
  return new Error(message);
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError('Agent execution cancelled.');
}

function assertAgentInputWithinCapabilityBudget(
  file: File,
  capability: {
    safetyLimits: { maxPixels: number; maxFileSizeBytes: number };
  },
): Promise<void> {
  if (file.size > capability.safetyLimits.maxFileSizeBytes) {
    throw new Error('Execution denied: input exceeds the canonical capability file-size limit.');
  }
  return imageInfo(file).then(({ width, height }) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('Execution denied: image dimensions are invalid.');
    }
    if (width * height > capability.safetyLimits.maxPixels) {
      throw new Error('Execution denied: image dimensions exceed the canonical capability pixel limit.');
    }
  });
}


function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Secure confirmation receipt generation is unavailable.');
}

function executionPlanIdentity(plan: ExecutionPlanContract): string {
  return JSON.stringify({
    workflowName: plan.workflowName,
    confidence: plan.confidence,
    catalogFingerprint: plan.catalogFingerprint,
    steps: plan.steps.map((step) => ({
      toolId: step.toolId,
      params: step.params ?? {},
    })),
  });
}

function withExecutionGuards<T>(
  operation: Promise<T>,
  signal: AbortSignal | undefined,
  deadline: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (timer !== undefined) clearTimeout(timer);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onAbort = () => finish(() => reject(abortError('Agent execution cancelled.')));
    const remainingMs = Math.max(1, deadline - Date.now());
    const timer = setTimeout(
      () => finish(() => reject(new Error('Agent execution timed out.'))),
      remainingMs,
    );

    if (signal) {
      if (signal.aborted) {
        finish(() => reject(abortError('Agent execution cancelled.')));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    operation.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

function parseValidatedAgentPlan(plan: AgentPlan): ExecutionPlanContract {
  return parseExecutionPlan({
    workflowName: plan.workflowName,
    confidence: plan.confidence,
    catalogFingerprint: plan.catalogFingerprint,
    steps: plan.steps.map((step) => ({
      toolId: step.toolId,
      params: step.params ?? {},
    })),
  });
}

function verifyConfirmationReceipt(
  plan: ExecutionPlanContract,
  file: File,
  receipt: AgentConfirmationReceipt | null | undefined,
): void {
  if (!receipt?.token) {
    throw new Error('Execution denied: a current confirmation receipt is required.');
  }
  const record = confirmationRecords.get(receipt.token);
  if (
    !record ||
    record.file !== file ||
    record.plan !== plan ||
    record.planIdentity !== executionPlanIdentity(plan)
  ) {
    throw new Error('Execution denied: confirmation receipt is stale or does not match this plan and file.');
  }
  confirmationRecords.delete(receipt.token);
}

const EN_STOPWORDS = new Set(['a', 'an', 'the', 'this', 'my', 'it', 'to', 'of', 'for', 'please', 'do', 'does', 'did', 'on', 'with', 'and', 'or', 'but']);

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

  const candidateToolIds = new Set(candidates.map((candidate) => candidate.toolId));
  const normalizedPrompt = normalize(prompt);
  const hasExplicitCompoundConjunction =
    /(^|\s)(and|or)(\s|$)/u.test(normalizedPrompt) ||
    /(^|\s)و(\s|$)/u.test(normalizedPrompt);
  const winnerIntentIsExplicitCompound =
    hasExplicitCompoundConjunction &&
    normalize(winner.intent).split(/\s+/u).filter(Boolean).length >= 2 &&
    normalizedPrompt.includes(normalize(winner.intent));
  if (candidateToolIds.size > 1 && hasExplicitCompoundConjunction && !winnerIntentIsExplicitCompound) {
    throw new Error('Request is ambiguous. Multiple image operations were requested; create separate confirmed plans.');
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

  const agentPlan = Object.freeze({
    ...plan,
    requiresUserConfirmation: true as const,
    matchedIntent: matched.intent,
  });
  issuedPlans.set(agentPlan, Object.freeze({
    planIdentity: executionPlanIdentity(plan),
    file,
  }));
  return agentPlan;
}

export function confirmAgentPlan(
  plan: AgentPlan,
  file: File,
): AgentConfirmationReceipt {
  assertLocalImageFile(file);
  if (plan.requiresUserConfirmation !== true) {
    throw new Error('Confirmation denied: the plan is not confirmation-gated.');
  }
  const issued = issuedPlans.get(plan);
  if (!issued || issued.file !== file) {
    throw new Error('Confirmation denied: plan was not issued by the FLIXO Agent planner for this file.');
  }
  const validatedPlan = parseValidatedAgentPlan(plan);
  const identity = executionPlanIdentity(validatedPlan);
  if (issued.planIdentity !== identity || validatedPlan.catalogFingerprint !== TOOL_CATALOG.fingerprint) {
    throw new Error('Confirmation denied: plan is stale or does not match the current canonical tool catalog.');
  }
  const token = randomToken();
  confirmationRecords.set(token, Object.freeze({
    plan,
    planIdentity: identity,
    file,
  }));
  return Object.freeze({ token });
}

export function revokeAgentConfirmation(receipt: AgentConfirmationReceipt | null | undefined): void {
  if (receipt?.token) confirmationRecords.delete(receipt.token);
}

export async function executeAgentPlan(
  plan: AgentPlan,
  file: File,
  receipt: AgentConfirmationReceipt | null | undefined,
  signal?: AbortSignal,
): Promise<Readonly<{ blob: Blob; fileName: string }>> {
  assertLocalImageFile(file);
  if (plan.requiresUserConfirmation !== true) {
    throw new Error('Execution denied: explicit user confirmation is required.');
  }

  const validatedPlan = parseValidatedAgentPlan(plan);
  if (validatedPlan.catalogFingerprint !== TOOL_CATALOG.fingerprint) {
    throw new Error('Execution denied: plan is stale relative to the current canonical tool catalog.');
  }
  assertNotAborted(signal);
  verifyConfirmationReceipt(validatedPlan, file, receipt);

  const steps = validatedPlan.steps.map((step) => step.toolId);
  if (steps.length !== 1) throw new Error('Agent execution is bounded to one local tool step.');

  const capability = getCapability(steps[0]);
  if (
    !capability ||
    capability.state !== 'EXECUTABLE' ||
    capability.executionMode !== 'LOCAL' ||
    capability.requirements.network ||
    capability.operational.executorId !== steps[0] ||
    typeof capability.verifier !== 'function'
  ) {
    throw new Error('Execution denied by the canonical capability boundary.');
  }
  await assertAgentInputWithinCapabilityBudget(file, capability);
  assertNotAborted(signal);
  const parameters = validateCapabilityParameters(steps[0], validatedPlan.steps[0].params ?? {});
  if (!CANONICAL_IMAGE_TOOL_IDS.includes(steps[0])) {
    throw new Error('Execution denied: tool is outside the canonical image executor.');
  }
  const deadline = Date.now() + capability.safetyLimits.timeoutMs;
  const confirmationToken = await createImageExecutionConfirmationToken(steps[0], parameters, []);
  const resultReceipt: CanonicalImageExecutionReceipt = await withExecutionGuards(
    executeCanonicalImageTool({
      toolId: steps[0],
      inputBlob: file,
      parameters,
      origin: 'agent',
      confirmed: true,
      confirmationToken,
    }),
    signal,
    deadline,
  );
  assertNotAborted(signal);
  return { blob: resultReceipt.outputBlob, fileName: file.name };
}
