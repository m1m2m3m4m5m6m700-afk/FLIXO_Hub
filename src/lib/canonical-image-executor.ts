import { getToolById, TOOL_CATALOG } from '../config/registry.ts';
import { getCapability, validateCapabilityParameters, type CanonicalCapabilityParameters } from '../config/manual-capability-definition.ts';
import { getToolOutputContract } from './contracts/tool-output-contracts.ts';
import { validateOutputIntegrity } from './contracts/output-integrity.ts';
import { executeCanonicalImageEngine, imageInfo } from '../tools/image-toolkit/engine.ts';

export const CANONICAL_IMAGE_TOOL_IDS = Object.freeze(["background-remover","image-upscaler","image-cropper","image-compressor","image-converter","image-effects","image-resizer","image-rotate-flip","image-brightness-contrast","image-saturation-hue","image-exposure","image-highlights-shadows","image-sharpen","image-blur","image-grayscale-duotone","image-filters","image-watermark","image-text-overlay","image-draw-annotate","image-redaction"]) as readonly string[];
export type ImageExecutionOrigin = 'manual' | 'agent';
export type ImageExecutionLayer = Readonly<{ id: string; locked: boolean }>;
export type AgentExecutionSecurityContext = Readonly<{
  taskId: string;
  taskRevision: number;
  documentRevision: number;
  documentFingerprint: string;
  planFingerprint: string;
  catalogFingerprint: string;
  expiresAt: number;
}>;
export type CanonicalImageExecutionRequest = Readonly<{
  toolId: string;
  inputBlob: Blob;
  parameters?: Readonly<Record<string, unknown>>;
  origin: ImageExecutionOrigin;
  confirmed?: boolean;
  confirmationToken?: string;
  securityContext?: AgentExecutionSecurityContext;
  targetLayerIds?: readonly string[];
  layers?: readonly ImageExecutionLayer[];
  signal?: AbortSignal;
}>;
export type CanonicalImageExecutionReceipt = Readonly<{
  toolId: string;
  executorId: string;
  status: 'VERIFIED';
  verifier: 'PASS';
  outputBlob: Blob;
  outputMime: string;
  outputBytes: number;
  durationMs: number;
  catalogFingerprint: string;
  confirmationRequired: boolean;
}>;

function canonicalSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalSort);
  if (value && typeof value === 'object') {
    const record=value as Record<string,unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key)=>[key,canonicalSort(record[key])]));
  }
  return value;
}
async function sha256(value: string): Promise<string> {
  if(!globalThis.crypto?.subtle) throw new Error('CONFIRMATION_CRYPTO_UNAVAILABLE');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),(b)=>b.toString(16).padStart(2,'0')).join('');
}

async function sha256Bytes(value: ArrayBuffer): Promise<string> {
  if(!globalThis.crypto?.subtle) throw new Error('CONFIRMATION_CRYPTO_UNAVAILABLE');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',value);
  return Array.from(new Uint8Array(digest),(b)=>b.toString(16).padStart(2,'0')).join('');
}

function randomNonce(): string {
  if (!globalThis.crypto?.getRandomValues) throw new Error('CONFIRMATION_CRYPTO_UNAVAILABLE');
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes,(b)=>b.toString(16).padStart(2,'0')).join('');
}

function assertSecurityContext(context: AgentExecutionSecurityContext): void {
  if (!context.taskId.trim()) throw new Error('AGENT_TASK_ID_REQUIRED');
  if (!Number.isInteger(context.taskRevision) || context.taskRevision < 0) throw new Error('AGENT_TASK_REVISION_INVALID');
  if (!Number.isInteger(context.documentRevision) || context.documentRevision < 0) throw new Error('AGENT_DOCUMENT_REVISION_INVALID');
  if (!/^[a-f0-9]{64}$/.test(context.documentFingerprint)) throw new Error('AGENT_DOCUMENT_FINGERPRINT_INVALID');
  if (!/^[a-f0-9]{64}$/.test(context.planFingerprint)) throw new Error('AGENT_PLAN_FINGERPRINT_INVALID');
  if (!/^[a-f0-9]{64}$/.test(context.catalogFingerprint)) throw new Error('AGENT_CATALOG_FINGERPRINT_INVALID');
  if (!Number.isFinite(context.expiresAt) || context.expiresAt <= Date.now() || context.expiresAt > Date.now() + 5 * 60_000) {
    throw new Error('AGENT_CONFIRMATION_EXPIRY_INVALID');
  }
}

const consumedConfirmationTokens = new Set<string>();
const MAX_CONSUMED_TOKENS = 4096;

export async function createImageExecutionConfirmationToken(
  toolId:string,
  parameters:Readonly<Record<string,unknown>>={},
  targetLayerIds:readonly string[]=[],
  securityContext?: AgentExecutionSecurityContext,
):Promise<string>{
  if (!securityContext) throw new Error('AGENT_SECURITY_CONTEXT_REQUIRED');
  assertSecurityContext(securityContext);
  const nonce = randomNonce();
  const payload = canonicalSort({
    version: 2,
    nonce,
    toolId,
    parameters,
    targetLayerIds:[...targetLayerIds].sort(),
    taskId:securityContext.taskId,
    taskRevision:securityContext.taskRevision,
    documentRevision:securityContext.documentRevision,
    documentFingerprint:securityContext.documentFingerprint,
    planFingerprint:securityContext.planFingerprint,
    catalogFingerprint:securityContext.catalogFingerprint,
    expiresAt:securityContext.expiresAt,
  });
  const digest = await sha256(JSON.stringify(payload));
  return `${nonce}.${securityContext.expiresAt}.${digest}`;
}

async function consumeAndValidateConfirmationToken(
  token: string,
  toolId: string,
  parameters: CanonicalCapabilityParameters,
  targetLayerIds: readonly string[],
  securityContext: AgentExecutionSecurityContext,
): Promise<void> {
  assertSecurityContext(securityContext);
  if (consumedConfirmationTokens.has(token)) throw new Error('CONFIRMATION_TOKEN_REPLAYED');
  const parts = token.split('.');
  if (parts.length !== 3 || !/^[a-f0-9]{32}$/.test(parts[0]) || !/^\d+$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) {
    throw new Error('CONFIRMATION_TOKEN_INVALID');
  }
  const expiresAt = Number(parts[1]);
  if (expiresAt !== securityContext.expiresAt || expiresAt <= Date.now()) throw new Error('CONFIRMATION_TOKEN_EXPIRED');
  const payload = canonicalSort({
    version: 2,
    nonce: parts[0],
    toolId,
    parameters,
    targetLayerIds:[...targetLayerIds].sort(),
    taskId:securityContext.taskId,
    taskRevision:securityContext.taskRevision,
    documentRevision:securityContext.documentRevision,
    documentFingerprint:securityContext.documentFingerprint,
    planFingerprint:securityContext.planFingerprint,
    catalogFingerprint:securityContext.catalogFingerprint,
    expiresAt,
  });
  const expected = await sha256(JSON.stringify(payload));
  if (parts[2] !== expected) throw new Error('CONFIRMATION_TOKEN_INVALID');
  consumedConfirmationTokens.add(token);
  if (consumedConfirmationTokens.size > MAX_CONSUMED_TOKENS) {
    const oldest = consumedConfirmationTokens.values().next().value;
    if (typeof oldest === 'string') consumedConfirmationTokens.delete(oldest);
  }
}

export async function fingerprintImageExecutionPlan(plan: unknown): Promise<string> {
  return sha256(JSON.stringify(canonicalSort(plan)));
}

export async function fingerprintImageBlob(blob: Blob): Promise<string> {
  if (!(blob instanceof Blob)) throw new Error('AGENT_DOCUMENT_FINGERPRINT_INPUT_INVALID');
  return sha256Bytes(await blob.arrayBuffer());
}
export function assertTargetLayersUnlocked(targetLayerIds:readonly string[]=[],layers:readonly ImageExecutionLayer[]=[]):void{
  if(!targetLayerIds.length) return;
  const byId=new Map(layers.map((layer)=>[layer.id,layer] as const));
  const locked=targetLayerIds.filter((id)=>byId.get(id)?.locked===true);
  if(locked.length) throw new Error('LOCKED_LAYER_EXECUTION_REJECTED:'+locked.join(','));
  const unknown=targetLayerIds.filter((id)=>!byId.has(id));
  if(unknown.length) throw new Error('TARGET_LAYER_NOT_FOUND:'+unknown.join(','));
}
async function assertLocalImageBlob(input:Blob,toolId:string,limit:{maxFileSizeBytes:number;maxPixels:number}):Promise<void>{
  if(!(input instanceof Blob)) throw new Error('INVALID_LOCAL_BLOB:'+toolId);
  if(!input.type.startsWith('image/')) throw new Error('INVALID_IMAGE_MIME:'+toolId);
  if(input.size<=0 || input.size>limit.maxFileSizeBytes) throw new Error('INPUT_SIZE_LIMIT_EXCEEDED:'+toolId);
  const info=await imageInfo(input);
  if(info.width*info.height>limit.maxPixels) throw new Error('INPUT_PIXEL_LIMIT_EXCEEDED:'+toolId);
}
function contractFor(toolId:string){
  const contract=getToolOutputContract(toolId);
  if(!contract) throw new Error('OUTPUT_CONTRACT_MISSING:'+toolId);
  const variant=contract.variants.find((entry)=>entry.kind==='image');
  if(!variant) throw new Error('IMAGE_OUTPUT_CONTRACT_MISSING:'+toolId);
  return variant;
}
function extensionForMime(mime:string):string{return mime==='image/jpeg'?'jpg':mime==='image/webp'?'webp':'png';}
async function verifyOutput(toolId:string,output:Blob,input:Blob,parameters:Record<string,string|number|boolean>,signal:AbortSignal):Promise<void>{
  const variant=contractFor(toolId);
  const info=await imageInfo(output);
  const bytes=new Uint8Array(await output.arrayBuffer());
  const integrity=validateOutputIntegrity(
    output.size,output.type,
    {toolId,allowedMime:variant.outputMimeTypes,minBytes:variant.minOutputBytes ?? 1,maxBytes:variant.maxOutputBytes ?? 50 * 1024 * 1024,maxPixels:variant.maxPixels ?? 100_000_000,allowedExtensions:variant.allowedExtensions,signatures:variant.signatures},
    info,
    {filename:'flixo-'+toolId+'.'+extensionForMime(output.type),bytes},
  );
  if(!integrity.valid) throw new Error('OUTPUT_INTEGRITY_FAILED:'+integrity.failures.join(';'));
  const capability=getCapability(toolId);
  if(!capability) throw new Error('CAPABILITY_NOT_EXECUTABLE:'+toolId);
  if(!(await capability.verifier(input,output,parameters,signal))) throw new Error('VERIFIER_FAILED:'+toolId);
}
async function executeWithDeadline(request:CanonicalImageExecutionRequest,parameters:Record<string,string|number|boolean>,timeoutMs:number):Promise<Blob>{
  const controller=new AbortController();
  const signal=controller.signal;
  const onAbort=()=>controller.abort(request.signal?.reason??new DOMException('Image execution cancelled.','AbortError'));
  request.signal?.addEventListener('abort',onAbort,{once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('Image execution timed out.','TimeoutError')),timeoutMs);
  try{return await executeCanonicalImageEngine(request.toolId,request.inputBlob,parameters,signal);}
  finally{clearTimeout(timer);request.signal?.removeEventListener('abort',onAbort);}
}
export async function validateCanonicalImageExecutionRequest(request:CanonicalImageExecutionRequest):Promise<{toolId:string;parameters:Record<string,string|number|boolean>;confirmationRequired:boolean;catalogFingerprint:string}>{
  const tool=getToolById(request.toolId);
  if(!tool || !CANONICAL_IMAGE_TOOL_IDS.includes(request.toolId)) throw new Error('UNKNOWN_TOOL:'+request.toolId);
  if (request.signal?.aborted) throw request.signal.reason instanceof Error ? request.signal.reason : new DOMException('Image execution cancelled.','AbortError');
  const capability=getCapability(request.toolId);
  if(!capability || capability.state!=='EXECUTABLE') throw new Error('CAPABILITY_NOT_EXECUTABLE:'+request.toolId);
  if(tool.executionMode!=='LOCAL' || tool.requirements.network) throw new Error('NON_LOCAL_TOOL_REJECTED:'+request.toolId);
  if(tool.operational.executorId!==request.toolId) throw new Error('EXECUTOR_ID_MISMATCH:'+request.toolId);
  if(tool.operational.outputContractId!==request.toolId) throw new Error('OUTPUT_CONTRACT_ID_MISMATCH:'+request.toolId);
  assertTargetLayersUnlocked(request.targetLayerIds??[],request.layers??[]);
  const parameters=validateCapabilityParameters(request.toolId,(request.parameters??{}) as CanonicalCapabilityParameters) as Record<string,string|number|boolean>;
  const confirmationRequired=request.origin==='agent' && capability.safetyContract.requiresUserConfirmationForAgent;
  if(confirmationRequired){
    if(request.confirmed!==true) throw new Error('CONFIRMATION_REQUIRED:'+request.toolId);
    if(!request.securityContext) throw new Error('AGENT_SECURITY_CONTEXT_REQUIRED:'+request.toolId);
    if(request.securityContext.catalogFingerprint !== TOOL_CATALOG.fingerprint) throw new Error('AGENT_CATALOG_STATE_CHANGED:'+request.toolId);
    const currentDocumentFingerprint = await fingerprintImageBlob(request.inputBlob);
    if(currentDocumentFingerprint !== request.securityContext.documentFingerprint) throw new Error('AGENT_DOCUMENT_STATE_CHANGED:'+request.toolId);
    await consumeAndValidateConfirmationToken(
      request.confirmationToken ?? '',
      request.toolId,
      parameters,
      request.targetLayerIds ?? [],
      request.securityContext,
    );
  }
  await assertLocalImageBlob(request.inputBlob,request.toolId,capability.safetyLimits);
  return {toolId:request.toolId,parameters,confirmationRequired,catalogFingerprint:TOOL_CATALOG.fingerprint};
}
export async function executeCanonicalImageTool(request:CanonicalImageExecutionRequest):Promise<CanonicalImageExecutionReceipt>{
  const started=typeof performance==='undefined'?Date.now():performance.now();
  const validated=await validateCanonicalImageExecutionRequest(request);
  const capability=getCapability(validated.toolId)!;
  const output=await executeWithDeadline(request,validated.parameters,capability.safetyLimits.timeoutMs);
  if(request.signal?.aborted) throw request.signal.reason instanceof Error?request.signal.reason:new DOMException('Image execution cancelled.','AbortError');
  await verifyOutput(validated.toolId,output,request.inputBlob,validated.parameters,request.signal??new AbortController().signal);
  const durationMs=Math.max(0,(typeof performance==='undefined'?Date.now():performance.now())-started);
  return Object.freeze({toolId:validated.toolId,executorId:capability.operational.executorId,status:'VERIFIED',verifier:'PASS',outputBlob:output,outputMime:output.type,outputBytes:output.size,durationMs,catalogFingerprint:validated.catalogFingerprint,confirmationRequired:validated.confirmationRequired});
}
