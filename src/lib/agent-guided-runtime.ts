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

export type AgentPlan = Readonly<ExecutionPlanContract & {
  requiresUserConfirmation: true;
  matchedIntent: string;
  confirmationToken: string;
  securityContext: AgentExecutionSecurityContext;
}>;

const MAX_AGENT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_PROMPT_CHARS = 2_000;

const DEFAULT_PARAMS: Readonly<Record<string, Record<string, string | number | boolean>>> = Object.freeze({
  'background-remover': { tolerance: 32 },
  'image-upscaler': { scale: 2 },
  'image-cropper': { aspectRatio: '1:1' },
  'image-compressor': { format: 'image/webp', quality: 0.8 },
  'image-converter': { format: 'image/webp' },
  'image-effects': { contrast: 115 },
  'image-resizer': { scale: 1.5 },
  'image-rotate-flip': { rotation: 90, flipX: false, flipY: false },
  'image-brightness-contrast': { brightness: 115, contrast: 100 },
  'image-saturation-hue': { saturation: 120, hue: 10 },
  'image-exposure': { exposure: 1 },
  'image-highlights-shadows': { highlights: 15, shadows: 15 },
  'image-sharpen': { amount: 110 },
  'image-blur': { radius: 6 },
  'image-grayscale-duotone': { intensity: 100, darkColor: '#111111', lightColor: '#f5f5f5' },
  'image-filters': { preset: 'vivid' },
  'image-watermark': { text: 'FLIXO', x: 10, y: 90, fontSize: 32, opacity: 0.65, color: '#ffffff' },
  'image-text-overlay': { text: 'FLIXO', x: 50, y: 50, fontSize: 48, color: '#ffffff', backgroundOpacity: 0.5, align: 'center' },
  'image-draw-annotate': { kind: 'arrow', x1: 10, y1: 10, x2: 80, y2: 80, stroke: '#ff3b30', strokeWidth: 8 },
  'image-redaction': { x: 25, y: 25, width: 50, height: 25, color: '#000000' },
});

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

function paramsFor(toolId: string): Readonly<Record<string, string | number | boolean>> {
  const params = DEFAULT_PARAMS[toolId];
  if (!params) return Object.freeze({});
  return Object.freeze({ ...params });
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

  const defaultParams = paramsFor(planned.toolId);
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
): Promise<CanonicalImageExecutionReceipt> {
  assertLocalImageFile(file);
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
  });
}
