import assert from 'node:assert/strict';
import test from 'node:test';
import { createCognitiveEvent } from '../../../scripts/agent-learning/cognitive-learning-engine.mjs';
import { createSupabaseCognitiveTransport, createProductionCognitiveLearning } from '../../../scripts/agent-learning/production-cognitive-learning.mjs';

const SHA='0000000000000000000000000000000000000001';

function makeEvent(overrides={}){
  return createCognitiveEvent({
    eventId:'evt-1',
    missionId:'mission-1',
    taskId:'task-1',
    agentId:'AGENT-01',
    sequence:1,
    epoch:3,
    eventType:'LESSON',
    causationId:null,
    correlationId:'corr-1',
    sourceSha:SHA,
    confidence:0.9,
    knowledgeStatus:'PROVISIONAL',
    createdAt:'2026-10-07T00:00:00Z',
    payload:{claim:'Use verified current-SHA evidence'},
    ...overrides,
  });
}

test('production transport maps the full cognitive event into the existing durable task-event RPC',async()=>{
  const calls=[];
  const transport=createSupabaseCognitiveTransport({
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'secret'},
    fetchImpl:async(url,options)=>{
      calls.push({url,options});
      return {ok:true,async text(){return JSON.stringify({sequence:7,hash:'h'});}};
    },
  });
  const result=await transport.append(makeEvent());
  assert.equal(result.status,'APPENDED');
  assert.equal(result.event.sequence,7);
  assert.equal(calls.length,1);
  const body=JSON.parse(calls[0].options.body);
  assert.equal(body.p_task_id,'task-1');
  assert.equal(body.p_event_type,'cognitive.lesson');
  assert.equal(body.p_source,'AGENT_LEARNING');
  assert.equal(body.p_idempotency_key,'evt-1');
  assert.equal(body.p_payload._cognitive.agentId,'AGENT-01');
  assert.equal(calls[0].options.headers.apikey,'secret');
  assert.equal(calls[0].options.headers.Authorization,'Bearer secret');
});

test('production transport treats database idempotency response as duplicate',async()=>{
  const transport=createSupabaseCognitiveTransport({
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'secret'},
    fetchImpl:async()=>({ok:true,async text(){return 'null';}}),
  });
  const result=await transport.append(makeEvent());
  assert.equal(result.status,'DUPLICATE');
});

test('production replay reconstructs cognitive events and catches hash-chain breaks',async()=>{
  const row=(event,sequence,previous_hash)=>({event_id:'db-id',task_id:event.taskId,sequence,payload:{_cognitive:event},previous_hash,hash:'hash-'+sequence});
  let rows=[row(makeEvent({sequence:9,eventId:'evt-9'}),9,null),row(makeEvent({sequence:10,eventId:'evt-10'}),10,'hash-9')];
  const transport=createSupabaseCognitiveTransport({
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'secret'},
    fetchImpl:async()=>({ok:true,async text(){return JSON.stringify(rows);}}),
  });
  const replay=await transport.replayTask('task-1',8);
  assert.deepEqual(replay.map(e=>e.eventId),['evt-9','evt-10']);
  rows[1].previous_hash='broken';
  await assert.rejects(()=>transport.replayTask('task-1',8),/COGNITIVE_REPLAY_HASH_CHAIN_BROKEN/);
});

test('production cognitive facade shares durable events and shared memory without granting authority',async()=>{
  const calls=[];
  const facade=createProductionCognitiveLearning({
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'secret'},
    fetchImpl:async(url,options)=>{
      calls.push({url,options});
      if(url.includes('/rpc/flixo_append_agent_task_event')) return {ok:true,async text(){return JSON.stringify({sequence:1,hash:'h'});}};
      return {ok:true,async text(){return '[]';}};
    },
  });
  const consumer=facade.consumer('AGENT-02','task-1');
  const event=makeEvent({eventId:'evt-2'});
  const result=await facade.events.append(event);
  consumer.ingest({...result.event,sequence:1});
  assert.equal(consumer.snapshot().consumerOffset,1);
  assert.equal(facade.memory.preflight(SHA,[{memory_id:'candidate',status:'VALIDATED',tested_sha:SHA},{memory_id:'usable',status:'PROMOTED',tested_sha:SHA}]).executableMemory[0].memory_id,'usable');
  assert.ok(calls.some(x=>x.url.includes('/rpc/flixo_append_agent_task_event')));
});

test('production projections rebuild from durable cognitive events after process restart',async()=>{
  const projectionEvent=createCognitiveEvent({
    eventId:'projection-1',
    missionId:'m',
    taskId:'task-1',
    agentId:'AGENT-01',
    sequence:3,
    epoch:4,
    eventType:'RESULT',
    causationId:null,
    correlationId:'projection-1',
    sourceSha:SHA,
    confidence:1,
    knowledgeStatus:'VALIDATED',
    createdAt:'2026-10-07T00:00:00Z',
    payload:{projection:{type:'XP_REWARD',agentId:'AGENT-01',input:{reason:'BUG_DISCOVERY',amount:16,taskId:'TASK-P',evidenceId:'E-P',verified:true,meaningfulImpact:.9,novelty:1,difficulty:.5}}},
  });
  const row={event_id:'db-id',task_id:'task-1',sequence:3,payload:{_cognitive:projectionEvent},previous_hash:null,hash:'hash-3'};
  const facade=createProductionCognitiveLearning({
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'secret'},
    fetchImpl:async()=>({ok:true,async text(){return JSON.stringify([row]);}}),
  });
  const rebuilt=await facade.rebuildProjections();
  assert.equal(rebuilt.eventCount,1);
  assert.equal(facade.excellence.snapshot('AGENT-01').xp,16);
});
