import { getToolById } from '@/config/registry.ts';
import { TOOL_CATALOG } from '@/config/registry.ts';
import { MVP_EXECUTABLE_TOOL_IDS, getCapability, validateCapabilityParameters, type CanonicalCapabilityParameters } from '@/config/manual-capability-definition.ts';
import { findToolIntent } from '@/lib/intent-router.ts';
import { parseExecutionPlan, type ExecutionPlanContract } from '@/lib/contracts/ai-plan.ts';
import { executeCanonicalTool, type CanonicalExecutionOutput } from '@/lib/execution/canonical-executor.ts';

export type AgentPlan = Readonly<ExecutionPlanContract & {
  requiresUserConfirmation: true;
  matchedIntent: string;
}>;

export type AgentConfirmationReceipt = Readonly<{ token: string }>;

type ConfirmationRecord = Readonly<{
  plan: AgentPlan;
  file: File;
  identity: string;
}>;

const MAX_PROMPT_CHARS = 2_000;
const MAX_FILE_BYTES = 512 * 1024 * 1024;
const issuedPlans = new WeakMap<object, { file: File; identity: string }>();
const confirmations = new Map<string, ConfirmationRecord>();

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().normalize('NFKC');
}

function assertSupportedFile(file: File): void {
  if (!file || file.size <= 0 || file.size > MAX_FILE_BYTES) {
    throw new Error('Agent Guided Workflow rejected the file size.');
  }
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    throw new Error('Agent Guided Workflow accepts image and video files only.');
  }
}

function matchedTools(prompt: string, file: File): Array<{ toolId: string; intent: string }> {
  const normalized = normalize(prompt);
  if (file.type.startsWith('image/')) {
    if (normalized.includes('compress') && normalized.includes('convert')) {
      return [
        { toolId: 'image-converter', intent: 'convert format' },
        { toolId: 'image-compressor', intent: 'compress' },
      ];
    }
    if ((normalized.includes('product') || normalized.includes('shop')) && (normalized.includes('square') || normalized.includes('shop'))) {
      return [
        { toolId: 'background-remover', intent: 'remove background' },
        { toolId: 'image-cropper', intent: 'crop' },
      ];
    }
  }
  const single = matchedTool(prompt);
  return [single];
}

function matchedTool(prompt: string): { toolId: string; intent: string } {
  const mvpIds = new Set<string>(MVP_EXECUTABLE_TOOL_IDS);
  const primary = findToolIntent(prompt, TOOL_CATALOG.ready).filter(({ tool }) => mvpIds.has(tool.id));
  const normalized = normalize(prompt);
  const intentMatches = TOOL_CATALOG.ready
    .filter((tool) => mvpIds.has(tool.id))
    .map((tool) => ({
      tool,
      intent: tool.capability.intents.find((intent) => normalized.includes(normalize(intent))) ?? tool.title,
      score: Math.max(...tool.capability.intents.map((intent) => normalized.includes(normalize(intent)) ? intent.length : 0), 0),
    }))
    .filter(({ score }) => score > 0);

  const candidates = [...primary.map(({ tool, score }) => ({
    tool,
    intent: tool.capability.intents[0] ?? tool.title,
    score,
  })), ...intentMatches];
  const bestById = new Map<string, { tool: typeof TOOL_CATALOG.ready[number]; intent: string; score: number }>();
  for (const candidate of candidates) {
    const current = bestById.get(candidate.tool.id);
    if (!current || candidate.score > current.score) bestById.set(candidate.tool.id, candidate);
  }
  const ranked = [...bestById.values()].sort((a, b) => b.score - a.score || a.tool.id.localeCompare(b.tool.id));
  if (!ranked.length) throw new Error('No admitted FLIXO MVP capability matches this request.');
  const [winner, second] = ranked;
  if (second && second.score === winner.score && second.tool.id !== winner.tool.id) {
    throw new Error('Request is ambiguous. Choose one supported FLIXO MVP operation.');
  }
  return { toolId: winner.tool.id, intent: winner.intent };
}

function parseDimensions(prompt: string): { width: number; height: number } | undefined {
  const match = normalize(prompt).match(/(?:^|\s)(\d{2,5})\s*[x×]\s*(\d{2,5})(?:\s|$)/u);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function percentParameter(prompt: string, name: 'brightness' | 'contrast' | 'saturation'): number | undefined {
  const normalized = normalize(prompt);
  const label = name === 'brightness' ? '(?:brightness|سطوع)' : name === 'contrast' ? '(?:contrast|تباين)' : '(?:saturation|تشبع)';
  const number = '(\\d{1,3})\\s*%?';
  const suffix = '(?:\\s+(?:increase|raise|خفض|خفضه|decrease|lower|رفع|ارفع))?\\s*(?:by|ب|بنسبة)?\\s*';
  const prefix = '(?:increase|raise|خفض|خفضه|decrease|lower|رفع|ارفع)?\\s*(?:the|ال)?\\s*';
  const afterVerb = normalized.match(new RegExp(prefix + label + suffix + number, 'u'));
  const beforeLabel = normalized.match(new RegExp(label + suffix + number, 'u'));
  const match = afterVerb ?? beforeLabel;
  if (!match) return undefined;
  const amount = Number(match[1] ?? match[2]);
  const decrease = /خفض|decrease|lower/u.test(match[0] ?? '');
  return Number.isFinite(amount) ? Math.max(0, Math.min(200, 100 + (decrease ? -amount : amount))) : undefined;
}

function parametersFor(toolId: string, prompt: string): CanonicalCapabilityParameters {
  const normalized = normalize(prompt);
  const dimensions = parseDimensions(prompt);
  const params: Record<string, string | number | boolean> = {};

  switch (toolId) {
    case 'background-remover':
      params.tolerance = 42;
      break;
    case 'image-upscaler': {
      const scale = normalized.match(/\b(\d+(?:\.\d+)?)\s*x\b/u);
      params.scale = scale ? Math.max(0.01, Math.min(8, Number(scale[1]))) : 2;
      break;
    }
    case 'image-cropper':
      if (normalized.includes('square') || normalized.includes('مربع')) params.aspectRatio = '1:1';
      if (dimensions) {
        params.width = dimensions.width;
        params.height = dimensions.height;
      }
      break;
    case 'image-compressor': {
      params.format = normalized.includes('png') ? 'image/png' : normalized.includes('jpg') || normalized.includes('jpeg') ? 'image/jpeg' : 'image/webp';
      params.quality = 0.82;
      const target = normalized.match(/(?:under|below|less than|أقل من|تحت)\s*(\d{1,6})\s*kb\b/u);
      if (target) params.targetSizeKB = Number(target[1]);
      break;
    }
    case 'image-converter':
      params.format = normalized.includes('png') ? 'image/png' : normalized.includes('jpg') || normalized.includes('jpeg') ? 'image/jpeg' : 'image/webp';
      break;
    case 'image-effects': {
      const hasBrightness = /brightness|سطوع/iu.test(normalized);
      const hasContrast = /contrast|تباين/iu.test(normalized);
      const hasSaturation = /saturation|تشبع/iu.test(normalized);
      const hasGrayscale = /grayscale|black and white|أبيض وأسود|تدرج رمادي/iu.test(normalized);
      const brightness = percentParameter(prompt, 'brightness');
      const contrast = percentParameter(prompt, 'contrast');
      const saturation = percentParameter(prompt, 'saturation');
      if ((hasBrightness && brightness === undefined) || (hasContrast && contrast === undefined) || (hasSaturation && saturation === undefined)) {
        throw new Error('Request is ambiguous. Specify the numeric adjustment for brightness, contrast, or saturation.');
      }
      if (!hasBrightness && !hasContrast && !hasSaturation && !hasGrayscale) {
        throw new Error('Request is ambiguous. Specify a measurable image effect.');
      }
      params.brightness = brightness ?? 100;
      params.contrast = contrast ?? 100;
      params.saturate = saturation ?? 100;
      if (hasGrayscale) params.grayscale = 100;
      break;
    }
    case 'video-trimmer': {
      const firstSeconds = normalized.match(/(?:first|أول|الأولى)\s*(\d{1,5})\s*(?:seconds?|ثواني?)/u);
      if (firstSeconds) params.endSec = Number(firstSeconds[1]);
      break;
    }
    case 'video-cropper':
      if (dimensions) {
        params.x = 0;
        params.y = 0;
        params.width = dimensions.width;
        params.height = dimensions.height;
      } else {
        params.x = 0;
        params.y = 0;
        params.width = 1280;
        params.height = 720;
      }
      break;
    case 'video-resizer':
      params.width = dimensions?.width ?? 1280;
      params.height = dimensions?.height ?? 720;
      break;
    case 'video-compressor':
      params.videoBitsPerSecond = 2_500_000;
      params.audioBitsPerSecond = 128_000;
      break;
  }

  const capability = getCapability(toolId);
  if (!capability) throw new Error('Agent capability is not registered: ' + toolId);
  if (toolId === 'image-effects' && params.brightness === 100 && params.contrast === 115 && params.saturate === 100 && params.grayscale === undefined) {
    params.contrast = 115;
  }
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
    throw typeof DOMException === 'function'
      ? new DOMException('Agent execution cancelled.', 'AbortError')
      : new Error('Agent execution cancelled.');
  }
}

function randomToken(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('Secure confirmation receipt generation is unavailable.');
  }
  return crypto.randomUUID();
}

export function planAgentRequest(prompt: string, file: File): AgentPlan {
  assertSupportedFile(file);
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length > MAX_PROMPT_CHARS) {
    throw new Error('Prompt must contain between 1 and 2,000 characters.');
  }

  const matches = matchedTools(trimmed, file);
  const steps = matches.map(({ toolId }) => {
    const tool = getToolById(toolId);
    if (!tool) throw new Error('Agent could not resolve a canonical MVP capability.');
    if (tool.family === 'image' && !file.type.startsWith('image/')) throw new Error('This capability requires an image file.');
    if (tool.family === 'video' && !file.type.startsWith('video/')) throw new Error('This capability requires a video file.');
    return { toolId, params: parametersFor(toolId, trimmed) };
  });
  const plan = parseExecutionPlan({
    workflowName: 'FLIXO Agent — ' + steps.map((step) => step.toolId).join(' -> '),
    confidence: 0.9,
    catalogFingerprint: TOOL_CATALOG.fingerprint,
    steps,
  });

  const result = Object.freeze({
    ...plan,
    requiresUserConfirmation: true as const,
    matchedIntent: intent,
  });
  issuedPlans.set(result, { file, identity: identityOf(plan) });
  return result;
}

export function confirmAgentPlan(plan: AgentPlan, file: File): AgentConfirmationReceipt {
  assertSupportedFile(file);
  const issued = issuedPlans.get(plan);
  if (!issued || issued.file !== file) {
    throw new Error('Confirmation denied: plan was not issued by the current FLIXO Agent planner for this file.');
  }

  const validated = parseExecutionPlan({
    workflowName: plan.workflowName,
    confidence: plan.confidence,
    catalogFingerprint: plan.catalogFingerprint,
    steps: plan.steps.map((step) => ({ toolId: step.toolId, params: step.params ?? {} })),
  });
  const identity = identityOf(validated);
  if (identity !== issued.identity || validated.catalogFingerprint !== TOOL_CATALOG.fingerprint) {
    throw new Error('Confirmation denied: plan is stale or differs from the canonical tool catalog.');
  }

  const token = randomToken();
  confirmations.set(token, Object.freeze({ plan, file, identity }));
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
  if (plan.requiresUserConfirmation !== true) {
    throw new Error('Execution denied: explicit user confirmation is required.');
  }

  const validated = parseExecutionPlan({
    workflowName: plan.workflowName,
    confidence: plan.confidence,
    catalogFingerprint: plan.catalogFingerprint,
    steps: plan.steps.map((step) => ({ toolId: step.toolId, params: step.params ?? {} })),
  });
  if (validated.catalogFingerprint !== TOOL_CATALOG.fingerprint) {
    throw new Error('Execution denied: plan is stale relative to the current canonical tool catalog.');
  }

  const record = receipt?.token ? confirmations.get(receipt.token) : undefined;
  if (!record || record.file !== file || record.plan !== plan || record.identity !== identityOf(validated)) {
    throw new Error('Execution denied: confirmation receipt is missing, stale, or bound to another plan/file.');
  }
  const confirmationToken = receipt?.token;
  if (!confirmationToken) {
    throw new Error('Execution denied: confirmation receipt token is required.');
  }
  confirmations.delete(confirmationToken);

  if (validated.steps.length !== 1) {
    throw new Error('Execution denied: the current Agent Guided MVP is bounded to one canonical tool step.');
  }
  const [step] = validated.steps;
  return executeCanonicalTool(step.toolId, { blob: file, fileName: file.name }, step.params ?? {}, signal);
}
