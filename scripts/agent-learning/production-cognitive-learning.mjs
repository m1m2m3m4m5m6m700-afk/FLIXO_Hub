import { createHash, randomUUID } from 'node:crypto';
import { createCognitiveEvent, CognitiveConsumer, FileConsumerCheckpointStore, AgentExcellenceRegistry, RoutingLearningEngine } from './cognitive-learning-engine.mjs';
import { assertExactSha, createCognitiveMemoryAdapter } from './shared-memory.mjs';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{40}$/i;
const EVENT_LIMIT=500;
const asKey=(env)=>env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
const assertKey=v=>{if(typeof v!=='string'||!v.trim())throw new Error('SUPABASE_SERVER_KEY_REQUIRED');return v;};
const rootUrl=v=>{if(typeof v!=='string'||!v.trim())throw new Error('SUPABASE_URL_REQUIRED');return v.replace(/\/+$/,'');};
function storageUuid(seed){if(UUID_RE.test(seed))return seed;const h=createHash('sha256').update(seed).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);}
function headers(key){return {apikey:key,...(String(key).startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key}),'Content-Type':'application/json',Accept:'application/json'};}
async function parse(response){const raw=await response.text();let body;try{body=raw?JSON.parse(raw):null;}catch{body=raw;}if(!response.ok)throw new Error('SUPABASE_REQUEST_FAILED:'+response.status+':'+(typeof body==='string'?body:JSON.stringify(body)));return body;}

export function createSupabaseCognitiveTransport({env=process.env,fetchImpl=globalThis.fetch}={}){
  const root=rootUrl(env.SUPABASE_URL||env.SUPABASE_PROJECT_URL);
  const key=assertKey(asKey(env));
  if(typeof fetchImpl!=='function')throw new Error('FETCH_REQUIRED');

  const rpc=async(name,payload)=>parse(await fetchImpl(root+'/rest/v1/rpc/'+name,{method:'POST',headers:headers(key),body:JSON.stringify(payload)}));
  const get=async(path)=>parse(await fetchImpl(root+path,{method:'GET',headers:headers(key)}));
  const getPaged=async(baseParams)=>{
    const all=[];
    for(let offset=0;;offset+=EVENT_LIMIT){
      const params=new URLSearchParams(baseParams);
      params.set('limit',String(EVENT_LIMIT));
      params.set('offset',String(offset));
      const rows=await get('/rest/v1/flixo_agent_task_events?'+params.toString());
      if(!Array.isArray(rows))throw new Error('COGNITIVE_REPLAY_INVALID_RESPONSE');
      all.push(...rows);
      if(rows.length<EVENT_LIMIT)break;
    }
    return all;
  };

  const append=async(event)=>{
    const exactSha=assertExactSha(event.sourceSha,'event.sourceSha');
    const cognitive=createCognitiveEvent({...event,sourceSha:exactSha,eventId:event.eventId||randomUUID()});
    const stored=await rpc('flixo_append_agent_task_event',{
      p_event_id:storageUuid(cognitive.eventId+'|'+cognitive.taskId),
      p_task_id:cognitive.taskId,
      p_event_type:'cognitive.'+cognitive.eventType.toLowerCase(),
      p_source:'AGENT_LEARNING',
      p_idempotency_key:cognitive.eventId,
      p_payload:{_cognitive:cognitive},
      p_occurred_at:cognitive.createdAt,
    });
    if(stored===null)return Object.freeze({status:'DUPLICATE',event:cognitive});
    const sequence=Number(stored.sequence);
    if(!Number.isInteger(sequence)||sequence<1)throw new Error('COGNITIVE_DB_SEQUENCE_INVALID');
    return Object.freeze({status:'APPENDED',event:Object.freeze({...cognitive,sequence})});
  };

  const replayTask=async(taskId,afterSequence=0)=>{
    if(typeof taskId!=='string'||!taskId.trim())throw new Error('TASK_ID_REQUIRED');
    if(!Number.isInteger(afterSequence)||afterSequence<0)throw new Error('OFFSET_INVALID');
    const params=new URLSearchParams({
      select:'event_id,task_id,sequence,payload,previous_hash,hash,occurred_at',
      task_id:'eq.'+taskId,
      sequence:'gt.'+String(afterSequence),
      order:'sequence.asc',
      limit:String(EVENT_LIMIT),
    });
    const rows=await getPaged(params);
    let previousHash=null;
    let expectedSequence=afterSequence+1;
    const events=[];
    for(const row of rows){
      const cognitive=row?.payload?._cognitive;
      if(!cognitive)continue;
      const event=Object.freeze({...cognitive,sequence:Number(row.sequence),taskId:row.task_id});
      if(!SHA.test(event.sourceSha))throw new Error('COGNITIVE_REPLAY_SHA_INVALID');
      if(!Number.isInteger(event.sequence)||event.sequence<1)throw new Error('COGNITIVE_REPLAY_SEQUENCE_INVALID');
      if(event.sequence!==expectedSequence)throw new Error('COGNITIVE_REPLAY_SEQUENCE_GAP');
      if(previousHash!==null && row.previous_hash!==previousHash)throw new Error('COGNITIVE_REPLAY_HASH_CHAIN_BROKEN');
      previousHash=row.hash;
      expectedSequence+=1;
      events.push(event);
    }
    return events;
  };

  const replayAll=async()=>{
    const params=new URLSearchParams({
      select:'event_id,task_id,sequence,payload,previous_hash,hash,occurred_at',
      order:'created_at.asc',
      limit:String(EVENT_LIMIT),
    });
    const rows=await getPaged(params);
    return rows.filter(row=>row?.payload?._cognitive).map(row=>Object.freeze({...row.payload._cognitive,sequence:Number(row.sequence),taskId:row.task_id}));
  };

  return Object.freeze({append,replayTask,replayAll});
}

export function createProductionCognitiveLearning({env=process.env,fetchImpl=globalThis.fetch}={}){
  const events=createSupabaseCognitiveTransport({env,fetchImpl});
  const memory=createCognitiveMemoryAdapter({
    ...env,
    SUPABASE_SECRET_KEY:env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const consumers=new Map();
  const checkpointStore=env.COGNITIVE_CHECKPOINT_PATH?new FileConsumerCheckpointStore(env.COGNITIVE_CHECKPOINT_PATH):null;
  let excellence=new AgentExcellenceRegistry();
  let routing=new RoutingLearningEngine();
  function applyProjection(event){
    const projection=event?.payload?.projection;
    if(!projection||typeof projection!=='object')return false;
    if(projection.type==='XP_REWARD') excellence.awardXp(projection.agentId,projection.input);
    else if(projection.type==='PERFORMANCE') excellence.recordPerformance(projection.agentId,projection.input);
    else if(projection.type==='ROUTING') routing.recordOutcome(projection.input);
    else return false;
    return true;
  }
  return Object.freeze({
    events,
    memory,
    get excellence(){return excellence;},
    get routing(){return routing;},
    epochState:async()=>{
      const stored=await events.replayAll();
      const lastSeen={};
      let currentEpoch=0,knowledgeVersion=0,worldModelVersion=0;
      for(const event of stored){
        currentEpoch=Math.max(currentEpoch,event.epoch);
        lastSeen[event.agentId]=Math.max(lastSeen[event.agentId]??0,event.epoch);
        if(['OBSERVATION','HYPOTHESIS','RESULT','EVIDENCE','COUNTEREXAMPLE','LESSON','INVALIDATION'].includes(event.eventType))knowledgeVersion++;
        if(['OBSERVATION','RESULT','EVIDENCE','COUNTEREXAMPLE','INVALIDATION'].includes(event.eventType))worldModelVersion++;
      }
      return Object.freeze({currentEpoch,agentLastSeenEpoch:Object.freeze(lastSeen),knowledgeVersion,worldModelVersion});
    },
    consumer(agentId,taskId){
      const key=agentId+'|'+taskId;
      if(!consumers.has(key))consumers.set(key,new CognitiveConsumer(agentId,{checkpointStore}));
      return consumers.get(key);
    },
    async catchUp(agentId,taskId){
      const consumer=this.consumer(agentId,taskId);
      const eventsToApply=await events.replayTask(taskId,consumer.snapshot().consumerOffset);
      for(const event of eventsToApply){consumer.ingest(event);applyProjection(event);}
      return consumer.snapshot();
    },
    async publishToRegisteredConsumers(event){
      const stored=await events.append(event);
      const acks=[];
      for(const [key,consumer] of consumers){
        if(!key.endsWith('|'+event.taskId))continue;
        const ack=consumer.ingest(stored.event);
        acks.push({agentId:consumer.agentId,status:ack.status,offset:consumer.snapshot().consumerOffset});
        if(ack.status!=='DUPLICATE')applyProjection(stored.event);
      }
      return Object.freeze({event:stored.event,status:stored.status,acks:Object.freeze(acks)});
    },
    async rebuildProjections(){
      excellence=new AgentExcellenceRegistry();
      routing=new RoutingLearningEngine();
      const stored=await events.replayAll();
      for(const event of stored) applyProjection(event);
      return Object.freeze({eventCount:stored.length});
    },
    async awardXp(input){
      const {currentSha,...xpInput}=input;
      const event=createCognitiveEvent({eventId:xpInput.eventId||randomUUID(),missionId:xpInput.missionId||'learning',taskId:xpInput.taskId,agentId:xpInput.agentId,sequence:1,epoch:xpInput.epoch||0,eventType:'RESULT',causationId:null,correlationId:xpInput.correlationId||xpInput.eventId||randomUUID(),sourceSha:currentSha,confidence:1,knowledgeStatus:'VALIDATED',createdAt:xpInput.createdAt||new Date().toISOString(),payload:{projection:{type:'XP_REWARD',agentId:xpInput.agentId,input:xpInput}}});
      const stored=await events.append(event);applyProjection(stored.event);return excellence.snapshot(xpInput.agentId);
    },
    async recordPerformance(input){
      const event=createCognitiveEvent({eventId:input.eventId||randomUUID(),missionId:input.missionId||'learning',taskId:input.taskId,agentId:input.agentId,sequence:1,epoch:input.epoch||0,eventType:'RESULT',causationId:null,correlationId:input.correlationId||input.eventId||randomUUID(),sourceSha:input.currentSha,confidence:1,knowledgeStatus:'VALIDATED',createdAt:input.createdAt||new Date().toISOString(),payload:{projection:{type:'PERFORMANCE',agentId:input.agentId,input}}});
      const stored=await events.append(event);applyProjection(stored.event);return excellence.snapshot(input.agentId);
    },
    async recordRoutingOutcome(input){
      const event=createCognitiveEvent({eventId:input.eventId||randomUUID(),missionId:input.missionId||'learning',taskId:input.taskId,agentId:input.agentId,sequence:1,epoch:input.epoch||0,eventType:'RESULT',causationId:null,correlationId:input.correlationId||input.eventId||randomUUID(),sourceSha:input.currentSha,confidence:1,knowledgeStatus:'VALIDATED',createdAt:input.createdAt||new Date().toISOString(),payload:{projection:{type:'ROUTING',input}}});
      const stored=await events.append(event);applyProjection(stored.event);return routing.stats(input.taskClass,input.agentId);
    },
  });
}
