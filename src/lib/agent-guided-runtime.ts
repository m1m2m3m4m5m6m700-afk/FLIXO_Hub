import {
  createImageExecutionConfirmationToken,
  executeCanonicalImageTool,
  fingerprintImageBlob,
  fingerprintImageExecutionPlan,
  type AgentExecutionSecurityContext,
  type CanonicalImageExecutionReceipt,
} from './canonical-image-executor';
import { planImageToolIntent, type ImageAgentPlan } from './image-agent-workflow';
import type { ExecutionPlanContract } from './contracts/ai-plan';
import { TOOL_CATALOG } from '../config/registry';
import { getDefaultAgentParameters } from '../config/manual-capability-definition';
import { imageInfo } from '../tools/image-toolkit/engine';

export type AgentPlan = Readonly<ExecutionPlanContract & {
  requiresUserConfirmation: true;
  matchedIntent: string;
  confirmationToken: string;
  securityContext: AgentExecutionSecurityContext;
}>;

const MAX_AGENT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_PROMPT_CHARS = 2_000;

// Default Agent parameters are sourced from the canonical capability registry.


const TASK_COUNTER = { value: 0 };

function assertLocalImageFile(file: File): void {
  if (!(file instanceof File)) throw new Error('Agent Guided Workflow requires a local File.');
  if (file.size <= 0 || file.size > MAX_AGENT_FILE_BYTES) {
    throw new Error('File rejected: size must be between 1 byte and 25 MB.');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Agent Guided Workflow accepts image files only.');
  }
}

function nextTaskId(): string {
  TASK_COUNTER.value += 1;
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'flixo-agent-task-' + Date.now().toString(36) + '-' + TASK_COUNTER.value.toString(36);
}

async function paramsFor(
  toolId: string,
  file: File,
): Promise<Readonly<Record<string, string | number | boolean>>> {
  const defaults = getDefaultAgentParameters(toolId);
  if (toolId !== 'image-cropper') return defaults;

  // A language-level crop request needs source dimensions; this is resolved
  // from the uploaded local image before the confirmation-bound plan is built.
  try {
    const info = await imageInfo(file);
    const size = Math.max(1, Math.min(info.width, info.height));
    return Object.freeze({
      x: 0,
      y: 0,
      cropWidth: size,
      cropHeight: size,
      width: size,
      height: size,
    });
  } catch {
    // Node contract tests do not expose browser image decoders. The canonical
    // bounded defaults keep planning deterministic there; browser execution
    // still resolves the actual uploaded dimensions when decoding is available.
    return defaults;
  }
}

async function buildSecurityContext(
  plan: ExecutionPlanContract,
  file: File,
): Promise<AgentExecutionSecurityContext> {
  const [planFingerprint, documentFingerprint] = await Promise.all([
    fingerprintImageExecutionPlan(plan),
    fingerprintImageBlob(file),
  ]);
  return Object.freeze({
    taskId: nextTaskId(),
    taskRevision: 0,
    documentRevision: 0,
    documentFingerprint,
    planFingerprint,
    catalogFingerprint: plan.catalogFingerprint,
    expiresAt: Date.now() + 5 * 60_000,
  });
}

export async function planAgentRequest(prompt: string, file: File): Promise<AgentPlan> {
  assertLocalImageFile(file);
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length > MAX_PROMPT_CHARS) {
    throw new Error('Prompt must contain between 1 and 2,000 characters.');
  }

  const planned: ImageAgentPlan = planImageToolIntent(trimmed, {});
  if (planned.status !== 'PLANNED' || !planned.plan || !planned.toolId) {
    throw new Error(planned.status === 'AMBIGUOUS'
      ? 'Request is ambiguous. Choose one supported image operation.'
      : 'No admitted FLIXO capability matches this request.');
  }

  const defaultParams = await paramsFor(planned.toolId, file);
  const plan = {
    ...planned.plan,
    steps: [{ toolId: planned.toolId, params: defaultParams }],
  };
  const securityContext = await buildSecurityContext(plan, file);
  const confirmationToken = await createImageExecutionConfirmationToken(
    planned.toolId,
    defaultParams,
    [],
    securityContext,
  );

  return Object.freeze({
    ...plan,
    requiresUserConfirmation: true as const,
    matchedIntent: planned.plan.steps[0].toolId,
    confirmationToken,
    securityContext,
  });
}

export async function executeAgentPlan(
  plan: AgentPlan,
  file: File,
  confirmed: boolean,
  signal?: AbortSignal,
): Promise<CanonicalImageExecutionReceipt> {
  assertLocalImageFile(file);
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Agent execution cancelled.', 'AbortError');
  if (!confirmed || plan.requiresUserConfirmation !== true) {
    throw new Error('Execution denied: explicit user confirmation is required.');
  }
  if (plan.catalogFingerprint !== TOOL_CATALOG.fingerprint) {
    throw new Error('Execution denied: canonical tool catalog changed after planning.');
  }
  if (plan.steps.length !== 1) {
    throw new Error('Agent execution is bounded to one local tool step.');
  }

  const currentPlanFingerprint = await fingerprintImageExecutionPlan({
    workflowName: plan.workflowName,
    confidence: plan.confidence,
    catalogFingerprint: plan.catalogFingerprint,
    steps: plan.steps,
  });
  if (currentPlanFingerprint !== plan.securityContext.planFingerprint) {
    throw new Error('Execution denied: execution plan changed after confirmation.');
  }

  return executeCanonicalImageTool({
    toolId: plan.steps[0].toolId,
    inputBlob: file,
    parameters: plan.steps[0].params ?? {},
    origin: 'agent',
    confirmed: true,
    confirmationToken: plan.confirmationToken,
    securityContext: plan.securityContext,
    signal,
  });
}
