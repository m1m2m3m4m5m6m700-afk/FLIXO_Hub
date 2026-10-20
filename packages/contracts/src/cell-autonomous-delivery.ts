export const AUTONOMOUS_DELIVERY_CONTRACT_VERSION="1.0.0" as const;
export const AUTONOMOUS_DELIVERY_STATES=Object.freeze(["ADMITTED","WORKING","RECONCILING","VERIFYING","RECOVERING","DONE","BLOCKED_EXTERNAL","BLOCKED_SAFETY"] as const);
export type AutonomousDeliveryState=(typeof AUTONOMOUS_DELIVERY_STATES)[number];
export type DeliveryFailureKind="TRANSIENT"|"EXTERNAL"|"SAFETY";
export type AutonomousTaskDelivery=Readonly<{
  taskId:string; agentId:string; sessionId:string; missionId:string;
  startSha:string; currentSha:string; candidateSha:string|null; publishedSha:string|null; verifiedSha:string|null;
  changedPaths:readonly string[]; expectedOutput:string; acceptanceDigest:string;
  state:AutonomousDeliveryState; attempt:number; maxAttempts:number;
  implemented:boolean; humanApprovalRequired:false;
}>;
export interface AutonomousTaskDeliveryStore {
  read(taskId:string):AutonomousTaskDelivery|null;
  write(record:AutonomousTaskDelivery):void;
  list():readonly AutonomousTaskDelivery[];
}

export class InMemoryAutonomousTaskDeliveryStore implements AutonomousTaskDeliveryStore {
  private readonly records=new Map<string,AutonomousTaskDelivery>();
  read(taskId:string){return this.records.get(taskId)??null;}
  write(record:AutonomousTaskDelivery){this.records.set(record.taskId,record);}
  list(){return Object.freeze([...this.records.values()]);}
}
const SHA=/^[0-9a-f]{40}$/iu;
const NEXT:Readonly<Record<AutonomousDeliveryState,readonly AutonomousDeliveryState[]>>=Object.freeze({
  ADMITTED:["WORKING","BLOCKED_EXTERNAL","BLOCKED_SAFETY"],
  WORKING:["RECONCILING","VERIFYING","RECOVERING","BLOCKED_EXTERNAL","BLOCKED_SAFETY"],
  RECONCILING:["WORKING","VERIFYING","RECOVERING","BLOCKED_EXTERNAL","BLOCKED_SAFETY"],
  VERIFYING:["RECONCILING","RECOVERING","DONE","BLOCKED_EXTERNAL","BLOCKED_SAFETY"],
  RECOVERING:["WORKING","RECONCILING","VERIFYING","BLOCKED_EXTERNAL","BLOCKED_SAFETY"],
  DONE:["RECONCILING"], BLOCKED_EXTERNAL:["ADMITTED","WORKING","RECOVERING"], BLOCKED_SAFETY:[]
});
const freeze=(r:AutonomousTaskDelivery)=>Object.freeze({...r,changedPaths:Object.freeze([...r.changedPaths]),humanApprovalRequired:false as const});
export function createAutonomousTaskDelivery(i:Readonly<{taskId:string;agentId:string;sessionId:string;missionId:string;startSha:string;expectedOutput:string;acceptanceDigest:string;maxAttempts?:number}>):AutonomousTaskDelivery{
  for(const [k,v] of Object.entries({taskId:i.taskId,agentId:i.agentId,sessionId:i.sessionId,missionId:i.missionId,expectedOutput:i.expectedOutput,acceptanceDigest:i.acceptanceDigest})) if(!String(v??"").trim()) throw new Error(k.toUpperCase()+"_REQUIRED");
  if(!SHA.test(i.startSha)) throw new Error("START_SHA_INVALID");
  return freeze({taskId:i.taskId,agentId:i.agentId,sessionId:i.sessionId,missionId:i.missionId,startSha:i.startSha,currentSha:i.startSha,candidateSha:null,publishedSha:null,verifiedSha:null,changedPaths:[],expectedOutput:i.expectedOutput,acceptanceDigest:i.acceptanceDigest,state:"ADMITTED",attempt:0,maxAttempts:Math.min(3,Math.max(1,Math.floor(i.maxAttempts??3))),implemented:false,humanApprovalRequired:false});
}
function transition(r:AutonomousTaskDelivery,s:AutonomousDeliveryState):AutonomousTaskDelivery{
  if(!(NEXT[r.state]??[]).includes(s)) throw new Error("INVALID_DELIVERY_TRANSITION:"+r.state+"->"+s);
  return freeze({...r,state:s});
}
export function startAutonomousDelivery(r:AutonomousTaskDelivery){return transition(r,"WORKING");}
export function recordAutonomousImplementation(r:AutonomousTaskDelivery,sha:string,paths:readonly string[]){
  if(!["WORKING","RECONCILING","RECOVERING"].includes(r.state)) throw new Error("IMPLEMENTATION_NOT_ALLOWED");
  if(!SHA.test(sha)) throw new Error("CANDIDATE_SHA_INVALID");
  if(!paths.length||paths.some(p=>!p.trim()||p.startsWith("/")||p.includes(".."))) throw new Error("IMPLEMENTATION_PATHS_REQUIRED");
  return freeze({...r,candidateSha:sha,publishedSha:null,verifiedSha:null,changedPaths:[...paths],implemented:true});
}
export function reconcileAutonomousDelivery(r:AutonomousTaskDelivery,liveSha:string){
  if(!SHA.test(liveSha)) throw new Error("LIVE_SHA_INVALID");
  if(r.currentSha===liveSha) return r;
  return freeze({...transition(r,"RECONCILING"),currentSha:liveSha,verifiedSha:null});
}
export function recordAutonomousPublication(r:AutonomousTaskDelivery,branch:string,publishedSha:string){
  if(branch!=="execution") throw new Error("PUBLICATION_BRANCH_DENIED");
  if(!r.implemented) throw new Error("PUBLICATION_REQUIRES_IMPLEMENTATION");
  if(!SHA.test(publishedSha)||publishedSha!==r.currentSha) throw new Error("PUBLICATION_SHA_MISMATCH");
  return freeze({...transition(r,"VERIFYING"),publishedSha,verifiedSha:null});
}
export function recordAutonomousVerification(r:AutonomousTaskDelivery,verifiedSha:string,liveSha:string,requiredPaths:readonly string[],observedPaths:readonly string[]){
  if(!["VERIFYING","RECONCILING"].includes(r.state)) throw new Error("VERIFICATION_NOT_ALLOWED");
  if(!SHA.test(verifiedSha)||verifiedSha!==liveSha||r.publishedSha!==verifiedSha) throw new Error("EXACT_SHA_PUBLICATION_VERIFICATION_MISMATCH");
  const observed=new Set(observedPaths);
  if(!requiredPaths.length||requiredPaths.some(p=>!observed.has(p))) throw new Error("PUBLISHED_PATH_MISSING");
  return freeze({...r,state:"DONE",currentSha:liveSha,verifiedSha});
}
export function recoverAutonomousDelivery(r:AutonomousTaskDelivery,agentId:string,sessionId:string,currentSha:string){
  if(!agentId.trim()||!sessionId.trim()) throw new Error("RECOVERY_OWNER_REQUIRED");
  if(agentId===r.agentId&&sessionId===r.sessionId) throw new Error("RECOVERY_REQUIRES_NEW_EXECUTION_OWNER");
  if(!SHA.test(currentSha)) throw new Error("RECOVERY_SHA_INVALID");
  return freeze({...transition(r,"RECOVERING"),agentId,sessionId,currentSha,verifiedSha:null});
}
export function recordAutonomousFailure(r:AutonomousTaskDelivery,kind:DeliveryFailureKind,retryable=true){
  if(kind==="SAFETY") return transition(r,"BLOCKED_SAFETY");
  const attempt=r.attempt+1;
  if(kind==="EXTERNAL"&&(!retryable||attempt>=r.maxAttempts)) return transition({...r,attempt},"BLOCKED_EXTERNAL");
  if(kind==="TRANSIENT"&&attempt>=r.maxAttempts) return transition({...r,attempt},"RECOVERING");
  return freeze({...r,attempt,state:"WORKING"});
}
export type AutonomousStopReason="DONE"|"BLOCKED_EXTERNAL"|"BLOCKED_SAFETY"|"HUMAN_APPROVAL"|"OWNER_ACTION"|"WAITING_FOR_HUMAN"|"REVIEW_REQUIRED";
export function assertAutonomousStopReason(reason:AutonomousStopReason){
  if(["HUMAN_APPROVAL","OWNER_ACTION","WAITING_FOR_HUMAN","REVIEW_REQUIRED"].includes(reason)) throw new Error("HUMAN_APPROVAL_NOT_A_VALID_EXECUTION_BLOCKER");
  if(!["DONE","BLOCKED_EXTERNAL","BLOCKED_SAFETY"].includes(reason)) throw new Error("NON_TERMINAL_STOP_REASON");
}
export function isAutonomousDeliveryComplete(r:AutonomousTaskDelivery,liveSha:string){
  return r.state==="DONE"&&r.implemented&&Boolean(r.publishedSha&&r.verifiedSha)&&r.publishedSha===r.verifiedSha&&r.verifiedSha===liveSha&&r.changedPaths.length>0&&r.humanApprovalRequired===false;
}
export function mustContinueAutonomousDelivery(r:AutonomousTaskDelivery){
  return !["DONE","BLOCKED_EXTERNAL","BLOCKED_SAFETY"].includes(r.state);
}
