import { getToolById, TOOL_CATALOG } from '@/config/registry.ts';
import { MVP_EXECUTABLE_TOOL_IDS, getCapability, validateCapabilityParameters, type CanonicalCapabilityParameters } from '@/config/manual-capability-definition.ts';
import { findToolIntent } from '@/lib/intent-router.ts';
import { parseExecutionPlan, type ExecutionPlanContract } from '@/lib/contracts/ai-plan.ts';
import { executeCanonicalTool, type CanonicalExecutionOutput } from '@/lib/execution/canonical-executor.ts';

export type AgentStructuredIntent = Readonly<{
  capabilityId: (typeof MVP_EXECUTABLE_TOOL_IDS)[number];
  normalizedPrompt: string;
  parameters: CanonicalCapabilityParameters;
  matchedIntent: string;
  source: 'deterministic-local-parser';
}>;

export type AgentPlan = Readonly<ExecutionPlanContract & {
  requiresUserConfirmation: true;
  matchedIntent: string;
  structuredIntent: AgentStructuredIntent;
}>;

export type AgentConfirmationReceipt = Readonly<{ token: string }>;
type IssuedPlan = Readonly<{ file: File; identity: string; revision: number }>;
type ConfirmationRecord = Readonly<IssuedPlan & { plan: AgentPlan }>;

const MAX_PROMPT_CHARS = 2_000;
const MAX_FILE_BYTES = 512 * 1024 * 1024;
const issuedPlans = new WeakMap<object, IssuedPlan>();
const revisions = new WeakMap<File, number>();
const confirmations = new Map<string, ConfirmationRecord>();

const normalize = (value: string): string => value.trim().toLocaleLowerCase().normalize('NFKC');

function revisionOf(file: File): number { return revisions.get(file) ?? 0; }

function nextRevision(file: File): number {
  const next = revisionOf(file) + 1;
  revisions.set(file, next);
  return next;
}

function assertSupportedFile(file: File): void {
  if (!file || file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error('Agent Guided Workflow rejected the file size.');
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Agent Guided Workflow accepts image and video files only.');
}

function matchedTool(prompt: string): { toolId: (typeof MVP_EXECUTABLE_TOOL_IDS)[number]; intent: string } {
  const matches = findToolIntent(prompt, TOOL_CATALOG.all).filter(({ tool }) =>
    (MVP_EXECUTABLE_TOOL_IDS as readonly string[]).includes(tool.id) && getCapability(tool.id)?.state === 'EXECUTABLE');
  if (!matches.length) throw new Error('No admitted FLIXO MVP capability matches this request.');
  const [winner, second] = matches;
  if (second && second.score === winner.score && second.tool.id !== winner.tool.id) throw new Error('Request is ambiguous. Choose one supported FLIXO MVP operation.');
  return { toolId: winner.tool.id as (typeof MVP_EXECUTABLE_TOOL_IDS)[number], intent: winner.tool.capability.intents[0] ?? winner.tool.title };
}

function dimensions(prompt: string): { width: number; height: number } | undefined {
  const m = normalize(prompt).match(/(?:^|\s)(\d{2,5})\s*[x×]\s*(\d{2,5})(?:\s|$)/u);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : undefined;
}

function percentParameter(prompt: string, name: 'brightness' | 'contrast' | 'saturation'): number | undefined {
  const n = normalize(prompt);
  const label = name === 'brightness' ? '(?:brightness|سطوع)' : name === 'contrast' ? '(?:contrast|تباين)' : '(?:saturation|تشبع)';
  const m = n.match(new RegExp(label + '\\s+(increase|raise|خفض|خفضه|decrease|lower|رفع|ارفع)?\\s*(?:by|ب|بنسبة)?\\s*(\\d{1,3})\\s*%?', 'u'));
  if (!m) return undefined;
  const amount = Number(m[2]);
  return Math.max(0, Math.min(200, 100 + (/خفض|decrease|lower/u.test(m[1] ?? '') ? -amount : amount)));
}

function parametersFor(toolId: string, prompt: string): CanonicalCapabilityParameters {
  const n = normalize(prompt);
  const size = dimensions(prompt);
  const params: Record<string, string | number | boolean> = {};
  switch (toolId) {
    case 'background-remover': params.tolerance = 42; break;
    case 'image-upscaler': {
      const m = n.match(/\b(\d+(?:\.\d+)?)\s*x\b/u);
      params.scale = m ? Math.max(1, Math.min(8, Number(m[1]))) : 2;
      break;
    }
    case 'image-cropper':
      if (n.includes('square') || n.includes('مربع')) params.aspectRatio = '1:1';
      if (size) { params.width = size.width; params.height = size.height; }
      break;
    case 'image-compressor':
      params.format = n.includes('png') ? 'image/png' : n.includes('jpg') || n.includes('jpeg') ? 'image/jpeg' : 'image/webp';
      params.quality = 0.82;
      break;
    case 'image-converter':
      params.format = n.includes('png') ? 'image/png' : n.includes('jpg') || n.includes('jpeg') ? 'image/jpeg' : 'image/webp';
      break;
    case 'image-effects':
      params.brightness = percentParameter(prompt, 'brightness') ?? 100;
      params.contrast = percentParameter(prompt, 'contrast') ?? 100;
      params.saturate = percentParameter(prompt, 'saturation') ?? 100;
      if (/grayscale|black and white|أبيض وأسود|تدرج رمادي/u.test(n)) params.grayscale = 100;
      if (params.brightness === 100 && params.contrast === 100 && params.saturate === 100 && params.grayscale === undefined) {
        throw new Error('Image effects require an explicit non-neutral adjustment.');
      }
      break;
    case 'video-trimmer': {
      const m = n.match(/(?:first|أول|الأولى)\s*(\d{1,5})\s*(?:seconds?|ثواني?)/u);
      if (m) params.endSec = Number(m[1]);
      break;
    }
    case 'video-cropper':
      params.x = 0; params.y = 0; params.width = size?.width ?? 1280; params.height = size?.height ?? 720;
      break;
    case 'video-resizer':
      params.width = size?.width ?? 1280; params.height = size?.height ?? 720;
      break;
    case 'video-compressor':
      params.videoBitsPerSecond = 2_500_000; params.audioBitsPerSecond = 128_000;
      break;
  }
  if (!getCapability(toolId)) throw new Error('Agent capability is not registered: ' + toolId);
  return validateCapabilityParameters(toolId, params);
}

function identityOf(plan: ExecutionPlanContract): string {
  return JSON.stringify({
    workflowName: plan.workflowName,
    confidence: plan.confidence,
    catalogFingerprint: plan.catalogFingerprint,
    steps: plan.steps.map((step) => ({ toolId: step.toolId, params: step.params ?? {} })),
  });
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw typeof DOMException === 'function' ? new DOMException('Agent execution cancelled.', 'AbortError') : new Error('Agent execution cancelled.');
  }
}

function randomToken(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') throw new Error('Secure confirmation receipt generation is unavailable.');
  return crypto.randomUUID();
}

export function planAgentRequest(prompt: string, file: File): AgentPlan {
  assertSupportedFile(file);
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length > MAX_PROMPT_CHARS) throw new Error('Prompt must contain between 1 and 2,000 characters.');
  const { toolId, intent } = matchedTool(trimmed);
  const tool = getToolById(toolId);
  const capability = getCapability(toolId);
  if (!tool || capability?.state !== 'EXECUTABLE') throw new Error('Agent could not resolve a canonical executable MVP capability.');
  if (tool.family === 'image' && !file.type.startsWith('image/')) throw new Error('This capability requires an image file.');
  if (tool.family === 'video' && !file.type.startsWith('video/')) throw new Error('This capability requires a video file.');

  const parameters = parametersFor(toolId, trimmed);
  const structuredIntent: AgentStructuredIntent = Object.freeze({
    capabilityId: toolId,
    normalizedPrompt: normalize(trimmed),
    parameters,
    matchedIntent: intent,
    source: 'deterministic-local-parser',
  });
  const canonicalPlan = parseExecutionPlan({
    workflowName: 'FLIXO Agent — ' + toolId,
    confidence: 0.9,
    catalogFingerprint: TOOL_CATALOG.fingerprint,
    steps: [{ toolId, params: parameters }],
  });
  const result = Object.freeze({ ...canonicalPlan, requiresUserConfirmation: true as const, matchedIntent: intent, structuredIntent });
  issuedPlans.set(result, { file, identity: identityOf(canonicalPlan), revision: nextRevision(file) });
  return result;
}

export function confirmAgentPlan(plan: AgentPlan, file: File): AgentConfirmationReceipt {
  assertSupportedFile(file);
  const issued = issuedPlans.get(plan);
  if (!issued || issued.file !== file) throw new Error('Confirmation denied: plan was not issued by the current FLIXO Agent planner for this file.');
  if (issued.revision !== revisionOf(file)) throw new Error('Confirmation denied: plan was superseded by a newer intent for this file.');
  const validated = parseExecutionPlan({
    workflowName: plan.workflowName,
    confidence: plan.confidence,
    catalogFingerprint: plan.catalogFingerprint,
    steps: plan.steps.map((step) => ({ toolId: step.toolId, params: step.params ?? {} })),
  });
  const identity = identityOf(validated);
  if (identity !== issued.identity || validated.catalogFingerprint !== TOOL_CATALOG.fingerprint) throw new Error('Confirmation denied: plan is stale or differs from the canonical tool catalog.');
  const token = randomToken();
  confirmations.set(token, Object.freeze({ ...issued, plan, identity }));
  return Object.freeze({ token });
}

export function revokeAgentConfirmation(receipt: AgentConfirmationReceipt | null | undefined): void {
  if (receipt?.token) confirmations.delete(receipt.token);
}

export async function executeAgentPlan(
  plan: AgentPlan,
  file: File,
  receipt: AgentConfirmationReceipt | null | undefined,
  signal?: AbortSignal,
): Promise<CanonicalExecutionOutput> {
  assertSupportedFile(file);
  assertNotAborted(signal);
  if (plan.requiresUserConfirmation !== true) throw new Error('Execution denied: explicit user confirmation is required.');
  const validated = parseExecutionPlan({
    workflowName: plan.workflowName,
    confidence: plan.confidence,
    catalogFingerprint: plan.catalogFingerprint,
    steps: plan.steps.map((step) => ({ toolId: step.toolId, params: step.params ?? {} })),
  });
  const issued = issuedPlans.get(plan);
  const record = receipt?.token ? confirmations.get(receipt.token) : undefined;
  if (!record || record.file !== file || record.plan !== plan || record.identity !== identityOf(validated) || !issued || issued.file !== file || issued.revision !== revisionOf(file)) {
    throw new Error('Execution denied: confirmation receipt is missing, stale, or bound to another plan/file.');
  }
  confirmations.delete(receipt.token!);
  if (validated.steps.length !== 1) throw new Error('Execution denied: the current Agent Guided MVP is bounded to one canonical tool step.');
  const [step] = validated.steps;
  return executeCanonicalTool(step.toolId, { blob: file, fileName: file.name }, step.params ?? {}, signal);
}
