import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import { CANONICAL_IMAGE_TOOL_IDS, assertTargetLayersUnlocked, createImageExecutionConfirmationToken, executeCanonicalImageTool, fingerprintImageBlob, fingerprintImageExecutionPlan, validateCanonicalImageExecutionRequest, type AgentExecutionSecurityContext } from '../src/lib/canonical-image-executor.ts';
import { confirmationTokenForImageAgentPlan, planImageToolIntent } from '../src/lib/image-agent-workflow.ts';
import { getCapability, validateCapabilityParameters } from '../src/config/manual-capability-definition.ts';
import { getToolOutputContract } from '../src/lib/contracts/tool-output-contracts.ts';


async function securityContextFor(plan: import('../src/lib/contracts/ai-plan.ts').ExecutionPlanContract, input: Blob): Promise<AgentExecutionSecurityContext> {
  const [planFingerprint, documentFingerprint] = await Promise.all([
    fingerprintImageExecutionPlan(plan),
    fingerprintImageBlob(input),
  ]);
  return Object.freeze({
    taskId: 'qa-task-' + Date.now().toString(36),
    taskRevision: 0,
    documentRevision: 0,
    documentFingerprint,
    planFingerprint,
    catalogFingerprint: TOOL_CATALOG.fingerprint,
    expiresAt: Date.now() + 60_000,
  });
}

const ids=["background-remover","image-upscaler","image-cropper","image-compressor","image-converter","image-effects","image-resizer","image-rotate-flip","image-brightness-contrast","image-saturation-hue","image-exposure","image-highlights-shadows","image-sharpen","image-blur","image-grayscale-duotone","image-filters","image-watermark","image-text-overlay","image-draw-annotate","image-redaction"] as readonly string[];

test('canonical registry contains all 20 requested image tools',()=>{
  assert.deepEqual([...CANONICAL_IMAGE_TOOL_IDS],ids);
  assert.equal(new Set(CANONICAL_IMAGE_TOOL_IDS).size,20);
  for(const id of ids){
    const tool=TOOL_CATALOG.byId.get(id);
    assert.ok(tool,id);
    assert.equal(tool?.capability.state,'EXECUTABLE');
    assert.equal(tool?.executionMode,'LOCAL');
    assert.equal(tool?.requirements.network,false);
    assert.equal(tool?.operational.executorId,id);
    assert.equal(tool?.operational.outputContractId,id);
    assert.equal(tool?.safetyContract.allowLockedLayerSelection,false);
    assert.equal(tool?.safetyContract.rawBlobEgress,false);
    assert.equal(tool?.safetyContract.requiresUserConfirmationForAgent,true);
    assert.equal(tool?.recovery.maxAttempts,1);
  }
});

test('all 20 canonical image capabilities have independent verifiers and output contracts',()=>{
  for(const id of ids){
    const capability=getCapability(id);
    const contract=getToolOutputContract(id);
    assert.ok(capability,'missing capability: '+id);
    assert.equal(typeof capability?.verifier,'function','missing verifier: '+id);
    assert.equal(capability?.execution,'browser-local');
    assert.equal(capability?.executionMode,'LOCAL');
    assert.equal(capability?.safetyContract.requiresUserConfirmationForAgent,true);
    assert.equal(capability?.safetyContract.allowLockedLayerSelection,false);
    assert.equal(capability?.safetyContract.rawBlobEgress,false);
    assert.equal(capability?.recovery.maxAttempts,1);
    assert.ok(contract?.variants.some((variant)=>variant.kind==='image'),'missing image output contract: '+id);
  }
});

test('canonical parameter normalization is stable for defaults',()=>{
  assert.equal((validateCapabilityParameters('image-sharpen',{}) as Record<string,unknown>).amount,110);
  assert.equal((validateCapabilityParameters('image-blur',{}) as Record<string,unknown>).radius,6);
  assert.equal((validateCapabilityParameters('image-watermark',{text:'FLIXO'}) as Record<string,unknown>).opacity,0.65);
  assert.equal((validateCapabilityParameters('image-text-overlay',{text:'FLIXO'}) as Record<string,unknown>).align,'center');
});

test('agent confirmation token helper binds validated effective parameters',async()=>{
  const planned=planImageToolIntent('sharpen image',{});
  assert.equal(planned.status,'PLANNED');
  assert.ok(planned.plan);
  const input = new Blob(['input'], { type: 'image/png' });
  const securityContext = await securityContextFor(planned.plan!, input);
  const token=await confirmationTokenForImageAgentPlan(planned.plan!,[],{},securityContext);
  assert.match(token, /^[a-f0-9]{32}\.\d+\.[a-f0-9]{64}$/);
});

test('unknown tools and locked layers fail closed',async()=>{
  const input=new Blob(['image'],{type:'image/png'});
  await assert.rejects(()=>validateCanonicalImageExecutionRequest({toolId:'not-a-tool',inputBlob:input,origin:'manual'}),/UNKNOWN_TOOL/);
  assert.throws(()=>assertTargetLayersUnlocked(['layer-1'],[{id:'layer-1',locked:true}]),/LOCKED_LAYER_EXECUTION_REJECTED/);
  assert.throws(()=>assertTargetLayersUnlocked(['missing'],[{id:'layer-1',locked:false}]),/TARGET_LAYER_NOT_FOUND/);
});

test('agent confirmation is mandatory and parameter-bound',async()=>{
  const input=new Blob(['image'],{type:'image/png'});
  const planned=planImageToolIntent('brightness contrast',{brightness:115,contrast:100});
  assert.equal(planned.status,'PLANNED');
  const plan=planned.plan!;
  const securityContext=await securityContextFor(plan,input);
  const token=await createImageExecutionConfirmationToken('image-brightness-contrast',{brightness:115,contrast:100},[],securityContext);
  await assert.rejects(()=>validateCanonicalImageExecutionRequest({toolId:'image-brightness-contrast',inputBlob:input,parameters:{brightness:115,contrast:100},origin:'agent'}),/CONFIRMATION_REQUIRED/);
  await assert.rejects(()=>validateCanonicalImageExecutionRequest({
    toolId:'image-brightness-contrast',
    inputBlob:input,
    parameters:{brightness:120,contrast:100},
    origin:'agent',
    confirmed:true,
    confirmationToken:token,
    securityContext,
  }),/CONFIRMATION_TOKEN_INVALID/);
});

test('20/20 agent intent routing reaches every canonical image tool',()=>{
  const cases=[
    ['remove background','background-remover'],
    ['upscale image','image-upscaler'],
    ['crop image','image-cropper'],
    ['compress image','image-compressor'],
    ['png to webp','image-converter'],
    ['image effects','image-effects'],
    ['change image dimensions','image-resizer'],
    ['rotate and flip','image-rotate-flip'],
    ['brightness contrast','image-brightness-contrast'],
    ['saturation hue','image-saturation-hue'],
    ['exposure','image-exposure'],
    ['highlights and shadows','image-highlights-shadows'],
    ['sharpen image','image-sharpen'],
    ['blur image','image-blur'],
    ['grayscale duotone','image-grayscale-duotone'],
    ['image filter preset','image-filters'],
    ['add watermark','image-watermark'],
    ['add text to image','image-text-overlay'],
    ['draw on image','image-draw-annotate'],
    ['redact image','image-redaction'],
  ] as const;
  assert.equal(cases.length,20);
  const validParameters: Readonly<Record<string, Readonly<Record<string, string | number | boolean>>>> = {
    'background-remover': { tolerance: 32 },
    'image-upscaler': { scale: 2 },
    'image-cropper': { x: 0, y: 0, cropWidth: 80, cropHeight: 80, width: 80, height: 80 },
    'image-compressor': { quality: 0.8, format: 'image/webp' },
    'image-converter': { format: 'image/webp' },
    'image-effects': { brightness: 115, contrast: 105 },
    'image-resizer': { scale: 2 },
    'image-rotate-flip': { rotation: 90, flipX: false, flipY: false },
    'image-brightness-contrast': { brightness: 115, contrast: 105 },
    'image-saturation-hue': { saturation: 120, hue: 10 },
    'image-exposure': { exposure: 1 },
    'image-highlights-shadows': { highlights: 10, shadows: 10 },
    'image-sharpen': { amount: 110 },
    'image-blur': { radius: 6 },
    'image-grayscale-duotone': { intensity: 100, darkColor: '#111111', lightColor: '#f5f5f5' },
    'image-filters': { preset: 'vivid' },
    'image-watermark': { text: 'FLIXO', x: 25, y: 90, fontSize: 32, opacity: 0.65, color: '#ffffff' },
    'image-text-overlay': { text: 'FLIXO', x: 25, y: 25, fontSize: 32, color: '#ffffff', backgroundOpacity: 0.5, align: 'center' },
    'image-draw-annotate': { kind: 'arrow', x1: 10, y1: 10, x2: 80, y2: 80, stroke: '#ff3b30', strokeWidth: 8 },
    'image-redaction': { x: 25, y: 25, width: 50, height: 25, color: '#000000' },
  };
  for(const [intent,expectedToolId] of cases){
    const planned=planImageToolIntent(intent,validParameters[expectedToolId]);
    assert.equal(planned.status,'PLANNED',`Agent did not plan: ${intent}`);
    assert.equal(planned.toolId,expectedToolId,`Wrong agent route for: ${intent}`);
    assert.equal(planned.confirmationRequired,true,`Agent confirmation not required for: ${expectedToolId}`);
    assert.ok(planned.plan?.catalogFingerprint,`Missing catalog fingerprint for: ${expectedToolId}`);
  }
});

test('router maps English and Arabic intents to canonical image tools',()=>{
  assert.equal(planImageToolIntent('add a watermark to the image',{text:'FLIXO'}).toolId,'image-watermark');
  assert.equal(planImageToolIntent('تعمية الصورة').toolId,'image-redaction');
  assert.equal(planImageToolIntent('زيادة حدة الصورة').toolId,'image-sharpen');
});

test('cancellation fails closed before image decoding',async()=>{
  const controller=new AbortController();
  controller.abort(new DOMException('cancelled','AbortError'));
  await assert.rejects(()=>executeCanonicalImageTool({
    toolId:'image-redaction',
    inputBlob:new Blob(['not-decoded'],{type:'image/png'}),
    parameters:{x:25,y:25,width:50,height:25,color:'#000000'},
    origin:'manual',
    signal:controller.signal,
  }),/Abort|cancel/i);
});

test('raw blob is not part of the agent plan contract',()=>{
  const planned=planImageToolIntent('add a watermark to the image',{text:'FLIXO'});
  assert.ok(planned.plan);
  const serialized=JSON.stringify(planned.plan);
  assert.equal(serialized.includes('Blob'),false);
  assert.equal(serialized.includes('ArrayBuffer'),false);
});

test('confirmation token is single-consumer under concurrent validation',async()=>{
  const input = new Blob(['not-an-image'], { type: 'application/pdf' });
  const planned = planImageToolIntent('redact image',{});
  assert.equal(planned.status,'PLANNED');
  const plan = planned.plan!;
  const securityContext = await securityContextFor(plan, input);
  const parameters = { x: 25, y: 25, width: 50, height: 25, color: '#000000' };
  const token = await createImageExecutionConfirmationToken('image-redaction', parameters, [], securityContext);
  const attempts = await Promise.allSettled([
    validateCanonicalImageExecutionRequest({
      toolId:'image-redaction', inputBlob:input, parameters, origin:'agent',
      confirmed:true, confirmationToken:token, securityContext,
    }),
    validateCanonicalImageExecutionRequest({
      toolId:'image-redaction', inputBlob:input, parameters, origin:'agent',
      confirmed:true, confirmationToken:token, securityContext,
    }),
  ]);
  const messages = attempts.map((attempt) => attempt.status === 'rejected' ? String(attempt.reason?.message ?? attempt.reason) : 'unexpected-pass');
  assert.equal(messages.filter((message) => /CONFIRMATION_TOKEN_REPLAYED/.test(message)).length, 1);
  assert.equal(messages.filter((message) => /INVALID_IMAGE_MIME/.test(message)).length, 1);
});
