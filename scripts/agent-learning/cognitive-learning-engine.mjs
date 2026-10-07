import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, openSync, readFileSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { dirname } from 'node:path';

export const CONTRACT_VERSION='1.0.0';
export const EVENT_TYPES=Object.freeze(['OBSERVATION','HYPOTHESIS','RESULT','EVIDENCE','COUNTEREXAMPLE','LESSON','INVALIDATION','DECISION']);
export const KNOWLEDGE_STATUSES=Object.freeze(['UNTRUSTED','PROVISIONAL','VALIDATED','PROMOTED','DISPUTED','STALE','REVOKED','SUPERSEDED']);
export const KNOWLEDGE_STAGES=Object.freeze(['RAW','PROVISIONAL','CHALLENGED','VALIDATED','PROMOTED']);
export const REPUTATION_DIMENSIONS=Object.freeze(['Security','Coding','Research','Falsification','Verification','Performance','Recovery']);
export const MASTERY_LEVELS=Object.freeze(['NOVICE','PRACTICED','VERIFIED','SPECIALIST','EXPERT','MASTER']);
export const XP_REWARD_REASONS=Object.freeze(['VERIFIED_IMPROVEMENT','BUG_DISCOVERY','COUNTEREXAMPLE','USEFUL_EVIDENCE','SUCCESSFUL_RECOVERY','REUSABLE_LEARNING','VALIDATED_STRATEGY_IMPROVEMENT']);
const SHA=/^[0-9a-f]{40}$/i,HASH=/^[0-9a-f]{64}$/i, nonEmpty=v=>typeof v==='string'&&v.trim().length>0;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:min));
export const stableStringify=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(stableStringify).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stableStringify(v[k])).join(',')+'}';
export const hashPayload=v=>createHash('sha256').update(stableStringify(v)).digest('hex');

export function assertCognitiveEvent(e){
  if(!e||typeof e!=='object') throw new Error('COGNITIVE_EVENT_INVALID');
  for(const k of ['eventId','missionId','taskId','agentId','correlationId','sourceSha','payloadHash','createdAt']) if(!nonEmpty(e[k])) throw new Error('COGNITIVE_EVENT_'+k.toUpperCase()+'_REQUIRED');
  if(!SHA.test(e.sourceSha)) throw new Error('COGNITIVE_EVENT_SOURCE_SHA_INVALID');
  if(!Number.isInteger(e.sequence)||e.sequence<1) throw new Error('COGNITIVE_EVENT_SEQUENCE_INVALID');
  if(!Number.isInteger(e.epoch)||e.epoch<0) throw new Error('COGNITIVE_EVENT_EPOCH_INVALID');
  if(!EVENT_TYPES.includes(e.eventType)) throw new Error('COGNITIVE_EVENT_TYPE_INVALID');
  if(e.causationId!==null&&!nonEmpty(e.causationId)) throw new Error('COGNITIVE_EVENT_CAUSATION_INVALID');
  if(!HASH.test(e.payloadHash)) throw new Error('COGNITIVE_EVENT_PAYLOAD_HASH_INVALID');
  if(e.payloadHash!==hashPayload(e.payload??{})) throw new Error('COGNITIVE_EVENT_PAYLOAD_HASH_MISMATCH');
  if(!Number.isFinite(e.confidence)||e.confidence<0||e.confidence>1) throw new Error('COGNITIVE_EVENT_CONFIDENCE_INVALID');
  if(!KNOWLEDGE_STATUSES.includes(e.knowledgeStatus)) throw new Error('COGNITIVE_EVENT_KNOWLEDGE_STATUS_INVALID');
  if(Number.isNaN(Date.parse(e.createdAt))) throw new Error('COGNITIVE_EVENT_CREATED_AT_INVALID');
  return Object.freeze({...e,sourceSha:e.sourceSha.toLowerCase(),payload:Object.freeze({...e.payload})});
}
export function createCognitiveEvent(i){const payload={...(i.payload??{})};return assertCognitiveEvent({...i,causationId:i.causationId??null,correlationId:i.correlationId??i.eventId,payloadHash:hashPayload(payload),payload});}

export function isRoutingTruth(m,currentSha){return Boolean(m&&m.status==='PROMOTED'&&m.sourceSha===currentSha&&m.independentConfirmations>=2&&m.usefulCount>=2&&m.regressionPassed===true&&m.harmfulCount===0);}
export function classifyKnowledge(m,currentSha){if(!m)throw new Error('KNOWLEDGE_REQUIRED');const stale=m.sourceSha!==currentSha;return {...m,status:stale&&m.status!=='REVOKED'?'STALE':m.status,routingTruth:!stale&&isRoutingTruth(m,currentSha)};}
const stageStatus=s=>({RAW:'UNTRUSTED',PROVISIONAL:'PROVISIONAL',CHALLENGED:'DISPUTED',VALIDATED:'VALIDATED',PROMOTED:'PROMOTED'})[s];
function validateMemory(m){if(!KNOWLEDGE_STAGES.includes(m.stage)||!KNOWLEDGE_STATUSES.includes(m.status)||!nonEmpty(m.claim)||!SHA.test(m.sourceSha))throw new Error('KNOWLEDGE_RECORD_INVALID');for(const k of ['independentConfirmations','usefulCount','harmfulCount'])if(!Number.isInteger(m[k])||m[k]<0)throw new Error('KNOWLEDGE_COUNT_INVALID');return m;}
export class MemoryCognitiveStore{
  constructor(clock=()=>new Date().toISOString()){this.clock=clock;this.records=new Map();}
  create(i){if(!nonEmpty(i.knowledgeId)||this.records.has(i.knowledgeId))throw new Error('KNOWLEDGE_ID_INVALID_OR_DUPLICATE');const m=validateMemory({knowledgeId:i.knowledgeId,claim:i.claim,stage:i.stage??'RAW',status:i.status??stageStatus(i.stage??'RAW'),sourceSha:i.sourceSha,confidence:clamp(i.confidence??0),evidenceIds:[...(i.evidenceIds??[])],independentConfirmations:i.independentConfirmations??0,usefulCount:i.usefulCount??0,harmfulCount:i.harmfulCount??0,regressionPassed:i.regressionPassed===true,updatedAt:this.clock(),supersedes:i.supersedes??null});this.records.set(m.knowledgeId,m);return this.get(m.knowledgeId);}
  get(id){const m=this.records.get(id);if(!m)throw new Error('KNOWLEDGE_NOT_FOUND');return Object.freeze({...m,evidenceIds:Object.freeze([...m.evidenceIds])});}
  advance(id,stage,patch={},currentSha=null){const cur=this.get(id),a=KNOWLEDGE_STAGES.indexOf(cur.stage),b=KNOWLEDGE_STAGES.indexOf(stage);if(b!==a+1)throw new Error('INVALID_KNOWLEDGE_TRANSITION');const m={...cur,...patch,stage,status:stageStatus(stage),updatedAt:this.clock()};if(stage==='PROMOTED'&&(m.sourceSha!==currentSha||m.independentConfirmations<2||m.usefulCount<2||!m.regressionPassed||m.harmfulCount!==0))throw new Error('PROMOTION_EVIDENCE_INCOMPLETE');this.records.set(id,validateMemory(m));return this.get(id);}
  revoke(id){const m={...this.get(id),status:'REVOKED',updatedAt:this.clock()};this.records.set(id,m);return this.get(id);}
  supersede(id,replacementId){const m={...this.get(id),status:'SUPERSEDED',supersedes:replacementId,updatedAt:this.clock()};this.records.set(id,m);return this.get(id);}
  forRouting(currentSha){return [...this.records.values()].filter(m=>isRoutingTruth(m,currentSha)).map(m=>this.get(m.knowledgeId));}
  classifyAll(currentSha){return [...this.records.values()].map(m=>classifyKnowledge(m,currentSha));}
}

export class FileCognitiveEventStore{
  constructor(filePath){this.filePath=filePath;mkdirSync(dirname(filePath),{recursive:true});}
  readAll(){if(!existsSync(this.filePath))return[];const raw=readFileSync(this.filePath,'utf8').trim();return raw?raw.split('\n').filter(Boolean).map(x=>assertCognitiveEvent(JSON.parse(x))):[];}
  append(event){assertCognitiveEvent(event);const rows=this.readAll(),dup=rows.find(x=>x.eventId===event.eventId);if(dup){if(dup.payloadHash!==event.payloadHash||dup.sequence!==event.sequence)throw new Error('COGNITIVE_EVENT_ID_COLLISION');return{status:'DUPLICATE',event:dup};}if(event.sequence!==rows.length+1)throw new Error('COGNITIVE_EVENT_SEQUENCE_GAP');const fd=openSync(this.filePath,'a');try{writeSync(fd,JSON.stringify(event)+'\n');fsyncSync(fd);}finally{closeSync(fd);}return{status:'APPENDED',event};}
  replay(afterSequence=0){return this.readAll().filter(e=>e.sequence>afterSequence);}
}
const isKnowledgeEvent=e=>['OBSERVATION','HYPOTHESIS','RESULT','EVIDENCE','COUNTEREXAMPLE','LESSON','INVALIDATION'].includes(e.eventType),isWorldEvent=e=>['OBSERVATION','RESULT','EVIDENCE','COUNTEREXAMPLE','INVALIDATION'].includes(e.eventType);
export class CognitiveEventLog{
  constructor({store=null,clock=()=>new Date().toISOString()}={}){this.store=store;this.clock=clock;this.events=store?store.readAll():[];this.epochCursor=this.events.length?this.events[this.events.length-1].epoch:0;}
  get currentEpoch(){return this.epochCursor;}get knowledgeVersion(){return this.events.filter(isKnowledgeEvent).length;}get worldModelVersion(){return this.events.filter(isWorldEvent).length;}
  createEvent(i){return createCognitiveEvent({...i,sequence:this.events.length+1,epoch:i.epoch??this.currentEpoch,createdAt:i.createdAt??this.clock()});}
  append(e){const r=this.store?this.store.append(e):this.appendMemory(e);if(r.status==='APPENDED'){this.events.push(e);this.epochCursor=Math.max(this.epochCursor,e.epoch);}return r;}
  appendMemory(e){assertCognitiveEvent(e);const dup=this.events.find(x=>x.eventId===e.eventId);if(dup){if(dup.payloadHash!==e.payloadHash||dup.sequence!==e.sequence)throw new Error('COGNITIVE_EVENT_ID_COLLISION');return{status:'DUPLICATE',event:dup};}if(e.sequence!==this.events.length+1)throw new Error('COGNITIVE_EVENT_SEQUENCE_GAP');return{status:'APPENDED',event:e};}
  publish(i){return this.append(this.createEvent(i));}replay(n=0){return this.events.filter(e=>e.sequence>n).map(assertCognitiveEvent);}
  startEpoch(epoch=this.currentEpoch+1){if(!Number.isInteger(epoch)||epoch<=this.currentEpoch)throw new Error('EPOCH_NOT_MONOTONIC');this.epochCursor=epoch;return epoch;}
  snapshot(){const m=new Map();for(const e of this.events)m.set(e.agentId,Math.max(m.get(e.agentId)??0,e.epoch));return Object.freeze({currentEpoch:this.currentEpoch,agentLastSeenEpoch:Object.freeze(Object.fromEntries(m)),knowledgeVersion:this.knowledgeVersion,worldModelVersion:this.worldModelVersion,eventCount:this.events.length,contractVersion:CONTRACT_VERSION});}
}
export class CognitiveConsumer{
  constructor(agentId){if(!nonEmpty(agentId))throw new Error('AGENT_ID_REQUIRED');Object.assign(this,{agentId,consumerOffset:0,lastSeenEpoch:0,knowledgeVersion:0,worldModelVersion:0,pending:new Map(),processed:new Set(),events:[]});}
  ingest(e){assertCognitiveEvent(e);if(this.processed.has(e.eventId)||e.sequence<=this.consumerOffset)return{status:'DUPLICATE',offset:this.consumerOffset};if(e.sequence>this.consumerOffset+1){this.pending.set(e.sequence,e);return{status:'BUFFERED_OUT_OF_ORDER',waitingFor:this.consumerOffset+1};}this.apply(e);while(this.pending.has(this.consumerOffset+1)){const n=this.pending.get(this.consumerOffset+1);this.pending.delete(this.consumerOffset+1);this.apply(n);}return{status:'ACKED',offset:this.consumerOffset};}
  apply(e){this.events.push(e);this.processed.add(e.eventId);this.consumerOffset=e.sequence;this.lastSeenEpoch=Math.max(this.lastSeenEpoch,e.epoch);if(isKnowledgeEvent(e))this.knowledgeVersion++;if(isWorldModelEvent(e))this.worldModelVersion++;}
  catchUp(log){for(const e of log.replay(this.consumerOffset))this.ingest(e);return this.snapshot();}
  snapshot(){return Object.freeze({agentId:this.agentId,consumerOffset:this.consumerOffset,lastSeenEpoch:this.lastSeenEpoch,knowledgeVersion:this.knowledgeVersion,worldModelVersion:this.worldModelVersion,pendingSequences:[...this.pending.keys()].sort((a,b)=>a-b)});}
}
export class ClaimGraph{
  constructor(){this.claims=new Map();this.edges=new Map();}
  addClaim({claimId,statement,agentId,status='UNTRUSTED',confidence=0.5,unresolvedQuestions=[]}){if(!nonEmpty(claimId)||!nonEmpty(statement)||!nonEmpty(agentId)||this.claims.has(claimId))throw new Error('CLAIM_INVALID_OR_DUPLICATE');const c=Object.freeze({claimId,statement,agentId,status,confidence:clamp(confidence),unresolvedQuestions:Object.freeze([...unresolvedQuestions])});this.claims.set(claimId,c);return c;}
  addRelation({edgeId,claimId,relation,agentId,targetId,confidence=0.5,evidenceIds=[]}){if(!this.claims.has(claimId)||!nonEmpty(edgeId)||this.edges.has(edgeId)||!nonEmpty(agentId)||!nonEmpty(targetId)||!['SUPPORT','OPPOSE','EVIDENCE'].includes(relation))throw new Error('CLAIM_EDGE_INVALID');const e=Object.freeze({edgeId,claimId,relation,agentId,targetId,confidence:clamp(confidence),evidenceIds:Object.freeze([...evidenceIds])});this.edges.set(edgeId,e);return e;}
  state(id){const claim=this.claims.get(id);if(!claim)throw new Error('CLAIM_NOT_FOUND');const edges=[...this.edges.values()].filter(e=>e.claimId===id);return Object.freeze({claim,support:edges.filter(e=>e.relation==='SUPPORT'),oppose:edges.filter(e=>e.relation==='OPPOSE'),evidence:edges.filter(e=>e.relation==='EVIDENCE'),unresolvedQuestions:claim.unresolvedQuestions});}
}
const baseline=Object.fromEntries(REPUTATION_DIMENSIONS.map(d=>[d,50])),novice=Object.fromEntries(REPUTATION_DIMENSIONS.map(d=>[d,'NOVICE']));
export function evaluateMastery(m){const s=m.repeatedVerifiedSuccesses??0,i=m.independentVerifications??0,c=clamp(m.crossTaskConsistency??0),f=clamp(m.falsePositiveRate??1),r=clamp(m.recoveryQuality??0);for(const [n,l,ind] of [[50,'MASTER',5],[25,'EXPERT',4],[12,'SPECIALIST',3],[6,'VERIFIED',2],[3,'PRACTICED',1]])if(s>=n&&i>=ind&&c>=.8&&f<=.1&&r>=.8)return l;return'NOVICE';}
export function decayReputationScore(score,daysInactive,halfLifeDays=90,base=50){return Number((base+(score-base)*Math.pow(.5,Math.max(0,daysInactive)/halfLifeDays)).toFixed(4));}
export function decayMasteryLevel(level,daysInactive,interval=120){const i=MASTERY_LEVELS.indexOf(level);if(i<0)throw new Error('MASTERY_LEVEL_INVALID');return MASTERY_LEVELS[Math.max(0,i-Math.floor(Math.max(0,daysInactive)/interval))];}
export class AgentExcellenceRegistry{
  constructor(clock=()=>new Date().toISOString()){this.clock=clock;this.agents=new Map();this.rewardKeys=new Set();}
  ensure(id){if(!nonEmpty(id))throw new Error('AGENT_ID_REQUIRED');if(!this.agents.has(id))this.agents.set(id,{agentId:id,xp:0,reputation:{...baseline},currentForm:50,mastery:{...novice},authority:null,lastActivity:this.clock(),updatedAt:this.clock(),performance:[]});return this.agents.get(id);}
  awardXp(id,{reason,amount,taskId,evidenceId,verified=true,meaningfulImpact=.5,novelty=1,difficulty=.25}){const a=this.ensure(id);if(!XP_REWARD_REASONS.includes(reason))throw new Error('XP_REASON_NOT_REWARDABLE');if(!verified||!nonEmpty(taskId)||!nonEmpty(evidenceId))throw new Error('XP_VERIFICATION_REQUIRED');
  if(meaningfulImpact<.5||novelty<=0||difficulty<.25)throw new Error('XP_IMPACT_TOO_LOW');if(!Number.isFinite(amount)||amount<=0||amount>100)throw new Error('XP_AMOUNT_INVALID');const key=id+'|'+reason+'|'+taskId;if(this.rewardKeys.has(key))throw new Error('XP_DUPLICATE_TASK_REWARD');this.rewardKeys.add(key);a.xp+=amount;a.lastActivity=this.clock();a.updatedAt=a.lastActivity;return a.xp;}
  recordPerformance(id,{dimension,verifiedSuccess,selfSelected=false,taskId,falsePositive=false,recoveryQuality=0,independentVerification=false,crossTaskConsistency=1}){const a=this.ensure(id);if(!REPUTATION_DIMENSIONS.includes(dimension)||!nonEmpty(taskId))throw new Error('PERFORMANCE_INPUT_INVALID');a.reputation[dimension]=clamp(a.reputation[dimension]+(verifiedSuccess?2:-1),0,100);a.currentForm=Number((.8*a.currentForm+.2*(verifiedSuccess?100:0)).toFixed(4));a.performance.push({dimension,verifiedSuccess,selfSelected,taskId,falsePositive,recoveryQuality,independentVerification,crossTaskConsistency,at:this.clock()});a.lastActivity=this.clock();a.updatedAt=a.lastActivity;this.recompute(a,dimension);return this.snapshot(id);}
  recompute(a,d){const rows=a.performance.filter(x=>x.dimension===d),ids=new Set(rows.map(x=>x.taskId)),success=rows.filter(x=>x.verifiedSuccess).length,ind=rows.filter(x=>x.independentVerification).length,fp=rows.length?rows.filter(x=>x.falsePositive).length/rows.length:1,recovery=rows.length?rows.reduce((s,x)=>s+x.recoveryQuality,0)/rows.length:0,cons=ids.size>=3?.8:ids.size/3;a.mastery[d]=evaluateMastery({repeatedVerifiedSuccesses:success,independentVerifications:ind,crossTaskConsistency:cons,falsePositiveRate:fp,recoveryQuality:recovery});}
  setAuthority(id,v){const a=this.ensure(id);a.authority=v;a.updatedAt=this.clock();return a.authority;}
  decay(now){const t=Date.parse(now);for(const a of this.agents.values()){const days=Math.max(0,(t-Date.parse(a.lastActivity))/86400000);for(const d of REPUTATION_DIMENSIONS)a.reputation[d]=decayReputationScore(a.reputation[d],days);for(const d of REPUTATION_DIMENSIONS)a.mastery[d]=decayMasteryLevel(a.mastery[d],days);a.currentForm=decayReputationScore(a.currentForm,days,45);a.updatedAt=now;}return[...this.agents.keys()].map(id=>this.snapshot(id));}
  snapshot(id){const a=this.ensure(id);return Object.freeze({agentId:a.agentId,xp:a.xp,reputation:Object.freeze({...a.reputation}),currentForm:a.currentForm,mastery:Object.freeze({...a.mastery}),authority:a.authority,updatedAt:a.updatedAt});}
}
export class RoutingLearningEngine{
  constructor(){this.outcomes=[];}
  recordOutcome(o){if(!nonEmpty(o.taskClass)||!nonEmpty(o.agentId)||!nonEmpty(o.outcomeId)||!o.verified)throw new Error('ROUTING_OUTCOME_INVALID');const x={...o,assignmentSuccess:Boolean(o.assignmentSuccess),taskClassFit:clamp(o.taskClassFit),recoveryRate:clamp(o.recoveryRate),cost:Math.max(0,Number(o.cost)),routingRegret:clamp(o.routingRegret),selfSelected:Boolean(o.selfSelected),exploration:Boolean(o.exploration)};this.outcomes.push(x);return Object.freeze(x);}
  stats(taskClass,agentId){const rows=this.outcomes.filter(o=>o.taskClass===taskClass&&o.agentId===agentId&&!o.selfSelected),self=this.outcomes.filter(o=>o.taskClass===taskClass&&o.agentId===agentId&&o.selfSelected);return Object.freeze({agentId,taskClass,samples:rows.length,assignmentSuccess:avg(rows.map(o=>o.assignmentSuccess?1:0)),taskClassFit:avg(rows.map(o=>o.taskClassFit)),cost:avg(rows.map(o=>o.cost)),recoveryRate:avg(rows.map(o=>o.recoveryRate)),routingRegret:avg(rows.map(o=>o.routingRegret)),explorationRate:avg(rows.map(o=>o.exploration?1:0)),selfSelectionBiasProtected:true,selfSelectedSamples:self.length});}
  select(taskClass,candidates,{explorationRate=.1,rng=Math.random}={}){if(!Array.isArray(candidates)||!candidates.length)throw new Error('ROUTING_CANDIDATES_REQUIRED');if(clamp(explorationRate)>0&&rng()<explorationRate){return Object.freeze({agentId:candidates[Math.floor(rng()*candidates.length)],reason:'EXPLORATION',exploration:true,score:null});}const scored=candidates.map(agentId=>{const s=this.stats(taskClass,agentId),score=s.assignmentSuccess*.35+s.taskClassFit*.25+s.recoveryRate*.15+(1/(1+s.cost))*.1-s.routingRegret*.15;return{agentId,score};}).sort((a,b)=>b.score-a.score);return Object.freeze({agentId:scored[0].agentId,reason:'EXPLOITATION',exploration:false,score:Number(scored[0].score.toFixed(6))});}
  metrics(taskClass){const r=this.outcomes.filter(o=>o.taskClass===taskClass&&!o.selfSelected);return Object.freeze({taskClass,samples:r.length,assignmentSuccess:avg(r.map(o=>o.assignmentSuccess?1:0)),routingRegret:avg(r.map(o=>o.routingRegret)),taskClassFit:avg(r.map(o=>o.taskClassFit)),cost:avg(r.map(o=>o.cost)),recoveryRate:avg(r.map(o=>o.recoveryRate)),explorationRate:avg(r.map(o=>o.exploration?1:0)),selfSelectionBiasProtected:true});}
}
const avg=v=>v.length?Number((v.reduce((a,b)=>a+b,0)/v.length).toFixed(4)):0;
export class CognitiveLearningEngine{constructor({store=null,clock=()=>new Date().toISOString()}={}){this.log=new CognitiveEventLog({store,clock});this.knowledge=new MemoryCognitiveStore(clock);this.claims=new ClaimGraph();this.excellence=new AgentExcellenceRegistry(clock);this.routing=new RoutingLearningEngine();}publish(i){return this.log.publish(i);}consumer(id){return new CognitiveConsumer(id);}replay(n=0){return this.log.replay(n);}snapshot(){return this.log.snapshot();}}
export function validateSharedConclusionIndependence(claims){const cs=(claims??[]).map(c=>c.conclusion).filter(Boolean);return cs.length===0||new Set(cs).size>1;}
export const COGNITIVE_CONTRACT=Object.freeze({version:CONTRACT_VERSION,eventTypes:EVENT_TYPES,knowledgeStatuses:KNOWLEDGE_STATUSES,knowledgeStages:KNOWLEDGE_STAGES,eventFields:['eventId','missionId','taskId','agentId','sequence','epoch','eventType','causationId','correlationId','sourceSha','payloadHash','confidence','knowledgeStatus','createdAt'],trustFlow:['RAW','PROVISIONAL','CHALLENGED','VALIDATED','PROMOTED'],routingTruthRule:'PROMOTED + current source SHA + validated evidence only',authorityRule:'XP, reputation, mastery, and performance never grant authority'});
