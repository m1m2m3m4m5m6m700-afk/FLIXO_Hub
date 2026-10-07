import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  COGNITIVE_CONTRACT,
  CognitiveEventLog,
  CognitiveLearningEngine,
  CognitiveConsumer,
  FileConsumerCheckpointStore,
  FileCognitiveEventStore,
  MemoryCognitiveStore,
  ClaimGraph,
  AgentExcellenceRegistry,
  RoutingLearningEngine,
  createCognitiveEvent,
  assertCognitiveEvent,
  isRoutingTruth,
} from '../../../scripts/agent-learning/cognitive-learning-engine.mjs';

const SHA='0000000000000000000000000000000000000001';
const SHA2='0000000000000000000000000000000000000002';

function event(input){return createCognitiveEvent({...input,missionId:'m',taskId:'t',agentId:input.agentId??'AGENT-A',sourceSha:SHA,confidence:0.9,knowledgeStatus:'PROVISIONAL',causationId:null,correlationId:input.correlationId??'c',createdAt:input.createdAt??'2026-10-07T00:00:00Z'});}

test('cognitive event contract is explicit and hash-bound',()=>{
  assert.deepEqual(COGNITIVE_CONTRACT.eventFields,['eventId','missionId','taskId','agentId','sequence','epoch','eventType','causationId','correlationId','sourceSha','payloadHash','confidence','knowledgeStatus','createdAt']);
  const forged={...event({eventId:'e',sequence:1,epoch:0,eventType:'OBSERVATION',payload:{x:1}}),payloadHash:'0'.repeat(64)}; assert.throws(()=>assertCognitiveEvent(forged),/PAYLOAD_HASH_MISMATCH/);
});

test('durable propagation supports replay and duplicate suppression',()=>{
  const dir=mkdtempSync(join(tmpdir(),'flixo-cognitive-'));
  try{
    const store=new FileCognitiveEventStore(join(dir,'events.jsonl'));
    const log=new CognitiveEventLog({store});
    log.append(event({eventId:'e1',sequence:1,epoch:1,eventType:'OBSERVATION',payload:{x:1}}));
    log.append(event({eventId:'e2',sequence:2,epoch:1,eventType:'LESSON',payload:{x:2}}));
    assert.equal(log.replay(0).length,2);
    assert.equal(store.append(log.replay(1)[0]).status,'DUPLICATE');
    const afterRestart=new CognitiveEventLog({store});
    assert.equal(afterRestart.snapshot().eventCount,2);
    const checkpoints=new FileConsumerCheckpointStore(join(dir,'consumer-offsets.jsonl'));
    const consumer=new CognitiveConsumer('AGENT-B',{checkpointStore:checkpoints});
    consumer.ingest(afterRestart.replay(0)[0]);
    consumer.catchUp(afterRestart);
    assert.equal(consumer.snapshot().consumerOffset,2);
    const resumed=new CognitiveConsumer('AGENT-B',{checkpointStore:checkpoints});
    assert.equal(resumed.snapshot().consumerOffset,2);
    resumed.catchUp(afterRestart);
    assert.equal(resumed.snapshot().consumerOffset,2);
    assert.equal(consumer.snapshot().lastSeenEpoch,1);
    assert.equal(consumer.snapshot().knowledgeVersion,2);
    assert.equal(consumer.snapshot().worldModelVersion,1);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('out-of-order events buffer until the missing sequence arrives',()=>{
  const consumer=new CognitiveConsumer('AGENT-B');
  const e1=event({eventId:'e1',sequence:1,epoch:1,eventType:'OBSERVATION',payload:{x:1}});
  const e2=event({eventId:'e2',sequence:2,epoch:1,eventType:'RESULT',payload:{x:2}});
  assert.equal(consumer.ingest(e2).status,'BUFFERED_OUT_OF_ORDER');
  assert.equal(consumer.ingest(e1).status,'ACKED');
  assert.equal(consumer.snapshot().consumerOffset,2);
  assert.equal(consumer.ingest(e2).status,'DUPLICATE');
});

test('epoch and derived knowledge/world-model versions advance deterministically',()=>{
  const log=new CognitiveEventLog();
  log.startEpoch(1);
  log.publish({eventId:'e1',missionId:'m',taskId:'t',agentId:'a',eventType:'OBSERVATION',payload:{ok:true},knowledgeStatus:'PROVISIONAL',confidence:0.8,sourceSha:SHA});
  log.startEpoch(2);
  log.publish({eventId:'e2',missionId:'m',taskId:'t',agentId:'a',eventType:'DECISION',payload:{decision:'X'},knowledgeStatus:'PROVISIONAL',confidence:0.8,sourceSha:SHA});
  assert.equal(log.snapshot().currentEpoch,2);
  assert.equal(log.snapshot().knowledgeVersion,1);
  assert.equal(log.snapshot().worldModelVersion,1);
  assert.deepEqual(log.snapshot().agentLastSeenEpoch,{a:2});
  assert.equal(log.snapshot().contractVersion,'1.0.0');
});

test('trust lifecycle blocks routing truth until validated evidence is promotable',()=>{
  const store=new MemoryCognitiveStore(()=> '2026-10-07T00:00:00Z');
  store.create({knowledgeId:'k1',claim:'X works',stage:'RAW',sourceSha:SHA,confidence:0.6});
  store.advance('k1','PROVISIONAL');
  store.advance('k1','CHALLENGED',{evidenceIds:['counter-1']});
  store.advance('k1','VALIDATED',{independentConfirmations:2,usefulCount:2,regressionPassed:true});
  assert.equal(store.forRouting(SHA).length,0);
  store.advance('k1','PROMOTED',{},SHA);
  assert.equal(store.forRouting(SHA).length,1);
  assert.equal(isRoutingTruth(store.get('k1'),SHA),true);
  assert.equal(store.forRouting(SHA2).length,0);
  assert.equal(store.revoke('k1').status,'REVOKED');
  assert.equal(store.forRouting(SHA).length,0);
});

test('conflicting claims remain independently represented without forced consensus',()=>{
  const graph=new ClaimGraph();
  graph.addClaim({claimId:'x',statement:'Use strategy X',agentId:'AGENT-A',status:'VALIDATED',confidence:0.8});
  graph.addRelation({edgeId:'s',claimId:'x',relation:'SUPPORT',agentId:'AGENT-A',targetId:'x',confidence:0.9});
  graph.addRelation({edgeId:'o',claimId:'x',relation:'OPPOSE',agentId:'AGENT-B',targetId:'x',confidence:0.85});
  graph.addRelation({edgeId:'u',claimId:'x',relation:'EVIDENCE',agentId:'AGENT-C',targetId:'e-17',confidence:0.5});
  const state=graph.state('x');
  assert.equal(state.support[0].agentId,'AGENT-A');
  assert.equal(state.oppose[0].agentId,'AGENT-B');
  assert.equal(state.contradictions[0].agentId,'AGENT-B');
  assert.equal(state.evidence[0].agentId,'AGENT-C');
});

test('XP economics rejects farming signals and duplicates, while authority stays separate',()=>{
  const registry=new AgentExcellenceRegistry(()=> '2026-10-07T00:00:00Z');
  registry.setAuthority('AGENT-A','NONE');
  registry.awardXp('AGENT-A',{reason:'BUG_DISCOVERY',amount:16,taskId:'T1',evidenceId:'E1',verified:true,meaningfulImpact:0.9,novelty:1,difficulty:0.5});
  assert.equal(registry.snapshot('AGENT-A').authority,'NONE');
  assert.throws(()=>registry.awardXp('AGENT-A',{reason:'BUG_DISCOVERY',amount:16,taskId:'T1',evidenceId:'E1',verified:true,meaningfulImpact:0.9,novelty:1,difficulty:0.5}),/XP_DUPLICATE_TASK_REWARD/);
  assert.throws(()=>registry.awardXp('AGENT-A',{reason:'VERIFIED_IMPROVEMENT',amount:10,taskId:'T2',evidenceId:'E2',verified:true,meaningfulImpact:0.1,novelty:1,difficulty:0.1}),/XP_IMPACT_TOO_LOW/);
  assert.throws(()=>registry.awardXp('AGENT-A',{reason:'COMMIT_COUNT',amount:10,taskId:'T3',evidenceId:'E3'}),/XP_REASON_NOT_REWARDABLE/);
  assert.equal(registry.snapshot('AGENT-A').xp,16);
});

test('reputation and mastery are multidimensional and mastery needs verified evidence quality',()=>{
  const r=new AgentExcellenceRegistry(()=> '2026-10-07T00:00:00Z');
  for(let i=0;i<3;i++) r.recordPerformance('AGENT-A',{dimension:'Security',verifiedSuccess:true,taskId:'SEC-'+i,falsePositive:false,recoveryQuality:0.9,independentVerification:true,crossTaskConsistency:1});
  const snap=r.snapshot('AGENT-A');
  assert.equal(snap.mastery.Security,'PRACTICED');
  assert.equal(snap.mastery.Coding,'NOVICE');
  assert.equal(snap.authority,null);
  assert.equal(Object.keys(snap.reputation).length,7);
});

test('reputation and mastery decay over inactivity',()=>{
  let now='2026-01-01T00:00:00Z';
  const r=new AgentExcellenceRegistry(()=>now);
  for(let i=0;i<6;i++) r.recordPerformance('AGENT-A',{dimension:'Recovery',verifiedSuccess:true,taskId:'R-'+i,falsePositive:false,recoveryQuality:1,independentVerification:true,crossTaskConsistency:1});
  assert.equal(r.snapshot('AGENT-A').mastery.Recovery,'VERIFIED');
  now='2026-10-01T00:00:00Z';
  const decayed=r.decay(now).find(x=>x.agentId==='AGENT-A');
  assert.ok(decayed.reputation.Recovery < 60);
  assert.equal(decayed.mastery.Recovery,'NOVICE');
});

test('cold start is safe: no fabricated history, all agents begin neutral and routing explores',()=>{
  const registry=new AgentExcellenceRegistry(()=> '2026-10-07T00:00:00Z');
  const initial=registry.snapshot('AGENT-C');
  assert.equal(initial.xp,0);
  assert.equal(initial.currentForm,50);
  assert.equal(initial.mastery.Security,'NOVICE');
  const r=new RoutingLearningEngine();
  assert.equal(r.stats('coding','AGENT-C').samples,0);
  assert.equal(r.select('coding',['AGENT-C'],{explorationRate:1,rng:()=>0.9}).reason,'EXPLORATION');
});

test('routing learning measures success, fit, regret, cost and recovery while excluding self-selected evidence',()=>{
  const r=new RoutingLearningEngine();
  for(let i=0;i<5;i++) r.recordOutcome({taskClass:'security',agentId:'A',outcomeId:'A-'+i,assignmentSuccess:true,taskClassFit:0.9,cost:1,recoveryRate:0.9,routingRegret:0.1,selfSelected:false,verified:true,createdAt:'2026-10-07T00:00:00Z'});
  r.recordOutcome({taskClass:'security',agentId:'A',outcomeId:'A-self',assignmentSuccess:false,taskClassFit:0.1,cost:100,recoveryRate:0,routingRegret:1,selfSelected:true,verified:true,createdAt:'2026-10-07T00:00:00Z'});
  r.recordOutcome({taskClass:'security',agentId:'B',outcomeId:'B-1',assignmentSuccess:false,taskClassFit:0.2,cost:5,recoveryRate:0.2,routingRegret:0.9,selfSelected:false,verified:true,createdAt:'2026-10-07T00:00:00Z'});
  assert.equal(r.stats('security','A').samples,5);
  assert.equal(r.stats('security','A').selfSelectedSamples,1);
  const chosen=r.select('security',['A','B'],{explorationRate:0,rng:()=>0.99});
  assert.equal(chosen.agentId,'A');
  assert.equal(r.select('security',['A','B'],{explorationRate:1,rng:()=>0.99}).reason,'EXPLORATION');
  assert.equal(r.metrics('security').selfSelectionBiasProtected,true);
});

test('live publish broadcasts to registered agents while preserving replay as the catch-up path',()=>{
  const engine=new CognitiveLearningEngine();
  const a=engine.consumer('AGENT-A');
  const b=engine.consumer('AGENT-B');
  const result=engine.publishToAll({eventId:'broadcast-1',missionId:'m',taskId:'t',agentId:'AGENT-A',eventType:'EVIDENCE',payload:{evidence:'ok'},knowledgeStatus:'VALIDATED',confidence:0.9,sourceSha:SHA});
  assert.equal(result.status,'APPENDED');
  assert.deepEqual(result.acks.map(x=>[x.agentId,x.status,x.offset]),[['AGENT-A','ACKED',1],['AGENT-B','ACKED',1]]);
  assert.equal(a.snapshot().consumerOffset,1);
  assert.equal(b.snapshot().consumerOffset,1);
});

test('performance and routing learning reject repeated identities to prevent same-task farming',()=>{
  const r=new AgentExcellenceRegistry();
  r.recordPerformance('AGENT-A',{dimension:'Coding',verifiedSuccess:true,taskId:'TASK-1'});
  assert.throws(()=>r.recordPerformance('AGENT-A',{dimension:'Coding',verifiedSuccess:true,taskId:'TASK-1'}),/DUPLICATE_TASK_PERFORMANCE/);
  const routing=new RoutingLearningEngine();
  const outcome={taskClass:'coding',agentId:'A',outcomeId:'OUT-1',assignmentSuccess:true,taskClassFit:0.9,cost:1,recoveryRate:1,routingRegret:0,selfSelected:false,verified:true,exploration:false,createdAt:'2026-10-07T00:00:00Z'};
  routing.recordOutcome(outcome);
  assert.throws(()=>routing.recordOutcome(outcome),/DUPLICATE_ROUTING_OUTCOME/);
  assert.throws(()=>r.awardXp('AGENT-A',{reason:'BUG_DISCOVERY',amount:20,taskId:'TASK-2',evidenceId:'E2',verified:true,meaningfulImpact:.9,novelty:1,difficulty:.5}),/XP_AMOUNT_MISMATCH/);
});

test('integrated engine keeps one shared substrate with separate knowledge, claims, excellence and routing projections',()=>{
  const engine=new CognitiveLearningEngine();
  engine.publish({eventId:'e1',missionId:'m',taskId:'t',agentId:'AGENT-A',eventType:'LESSON',payload:{lesson:'x'},knowledgeStatus:'PROVISIONAL',confidence:0.9,sourceSha:SHA});
  assert.equal(engine.snapshot().eventCount,1);
  assert.equal(engine.replay(0).length,1);
  assert.ok(engine.knowledge instanceof MemoryCognitiveStore);
  assert.ok(engine.claims instanceof ClaimGraph);
  assert.ok(engine.excellence instanceof AgentExcellenceRegistry);
  assert.ok(engine.routing instanceof RoutingLearningEngine);
});
