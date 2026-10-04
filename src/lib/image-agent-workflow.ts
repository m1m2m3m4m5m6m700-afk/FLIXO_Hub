import { TOOL_CATALOG } from '../config/registry.ts';
import { findToolIntent } from './intent-router.ts';
import { MAX_PLAN_STEPS, parseExecutionPlan, type ExecutionPlanContract } from './contracts/ai-plan.ts';
import {
  createImageExecutionConfirmationToken,
  executeCanonicalImageTool,
  fingerprintImageExecutionPlan,
  CANONICAL_IMAGE_TOOL_IDS,
  type AgentExecutionSecurityContext,
} from './canonical-image-executor.ts';

const imageIdSet=new Set<string>(CANONICAL_IMAGE_TOOL_IDS);

function primitiveParameters(parameters: Readonly<Record<string, unknown>>): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new Error('INVALID_AGENT_PARAMETER:' + key);
    }
    output[key] = value;
  }
  return output;
}

export type ImageAgentPlan=Readonly<{
  status:'PLANNED'|'NEEDS_INPUT'|'AMBIGUOUS';
  plan?:ExecutionPlanContract;
  toolId?:string;
  confirmationRequired?:true;
}>;

export type ImageAgentSecurityContext = Omit<AgentExecutionSecurityContext, 'planFingerprint' | 'catalogFingerprint'>;

export function planImageToolIntent(intent:string,parameters:Readonly<Record<string,unknown>>={}):ImageAgentPlan{
  const matches=findToolIntent(intent,TOOL_CATALOG.ready)
    .filter((match)=>imageIdSet.has(match.tool.id)&&match.tool.capability.state==='EXECUTABLE');
  if(!matches.length) return Object.freeze({status:'NEEDS_INPUT'});
  const best=matches[0];
  if(matches[1]&&matches[1].score>=best.score-5) return Object.freeze({status:'AMBIGUOUS'});
  const plan=Object.freeze({
    workflowName:'flixo-image-tool',
    confidence:Math.min(1,best.score/100),
    catalogFingerprint:TOOL_CATALOG.fingerprint,
    steps:[{toolId:best.tool.id,params:primitiveParameters(parameters)}],
  });
  parseExecutionPlan(plan);
  return Object.freeze({status:'PLANNED',plan,toolId:best.tool.id,confirmationRequired:true});
}

async function secureContextForPlan(plan: ExecutionPlanContract, context: ImageAgentSecurityContext): Promise<AgentExecutionSecurityContext> {
  const planFingerprint = await fingerprintImageExecutionPlan(plan);
  return Object.freeze({
    ...context,
    planFingerprint,
    catalogFingerprint: plan.catalogFingerprint,
  });
}

export async function executeImageAgentPlan(
  plan:ExecutionPlanContract,
  inputBlob:Blob,
  parametersOverride:Readonly<Record<string,unknown>>={},
  targetLayerIds:readonly string[]=[],
  layers:readonly {id:string;locked:boolean}[]=[],
  confirmed=false,
  confirmationToken?:string,
  signal?:AbortSignal,
  securityContext?:ImageAgentSecurityContext,
){
  const validated=parseExecutionPlan(plan);
  if(validated.steps.length>MAX_PLAN_STEPS) throw new Error('PLAN_STEP_LIMIT_EXCEEDED');
  if(!securityContext) throw new Error('AGENT_SECURITY_CONTEXT_REQUIRED');
  const step=validated.steps[0];
  const mergedParameters = { ...step.params, ...primitiveParameters(parametersOverride) };
  const secureContext = await secureContextForPlan(validated, securityContext);
  if (securityContext.planFingerprint !== undefined) {
    throw new Error('AGENT_PLAN_FINGERPRINT_MUST_BE_RUNTIME_BOUND');
  }
  return executeCanonicalImageTool({
    toolId:step.toolId,
    inputBlob,
    parameters:mergedParameters,
    origin:'agent',
    confirmed,
    confirmationToken,
    targetLayerIds,
    layers,
    signal,
    securityContext:secureContext,
  });
}

export async function confirmationTokenForImageAgentPlan(
  plan:ExecutionPlanContract,
  targetLayerIds:readonly string[]=[],
  parametersOverride:Readonly<Record<string,unknown>>={},
  securityContext:ImageAgentSecurityContext,
):Promise<string>{
  const validated=parseExecutionPlan(plan);
  const step=validated.steps[0];
  const parameters = { ...step.params, ...primitiveParameters(parametersOverride) };
  const secureContext = await secureContextForPlan(validated, securityContext);
  return createImageExecutionConfirmationToken(step.toolId,parameters,targetLayerIds,secureContext);
}
