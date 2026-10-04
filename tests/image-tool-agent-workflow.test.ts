import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import { CANONICAL_IMAGE_TOOL_IDS, assertTargetLayersUnlocked, createImageExecutionConfirmationToken, validateCanonicalImageExecutionRequest } from '../src/lib/canonical-image-executor.ts';
import { planImageToolIntent } from '../src/lib/image-agent-workflow.ts';

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
  }
});

test('unknown tools and locked layers fail closed',async()=>{
  const input=new Blob(['image'],{type:'image/png'});
  await assert.rejects(()=>validateCanonicalImageExecutionRequest({toolId:'not-a-tool',inputBlob:input,origin:'manual'}),/UNKNOWN_TOOL/);
  assert.throws(()=>assertTargetLayersUnlocked(['layer-1'],[{id:'layer-1',locked:true}]),/LOCKED_LAYER_EXECUTION_REJECTED/);
  assert.throws(()=>assertTargetLayersUnlocked(['missing'],[{id:'layer-1',locked:false}]),/TARGET_LAYER_NOT_FOUND/);
});

test('agent confirmation is mandatory and parameter-bound',async()=>{
  const input=new Blob(['image'],{type:'image/png'});
  const token=await createImageExecutionConfirmationToken('image-brightness-contrast',{brightness:115,contrast:100},[]);
  await assert.rejects(()=>validateCanonicalImageExecutionRequest({toolId:'image-brightness-contrast',inputBlob:input,parameters:{brightness:115,contrast:100},origin:'agent'}),/CONFIRMATION_REQUIRED/);
  await assert.rejects(()=>validateCanonicalImageExecutionRequest({toolId:'image-brightness-contrast',inputBlob:input,parameters:{brightness:120,contrast:100},origin:'agent',confirmed:true,confirmationToken:token}),/CONFIRMATION_TOKEN_INVALID/);
});

test('router maps English and Arabic intents to canonical image tools',()=>{
  assert.equal(planImageToolIntent('add a watermark to the image',{text:'FLIXO'}).toolId,'image-watermark');
  assert.equal(planImageToolIntent('تعمية الصورة').toolId,'image-redaction');
  assert.equal(planImageToolIntent('زيادة حدة الصورة').toolId,'image-sharpen');
});

test('raw blob is not part of the agent plan contract',()=>{
  const planned=planImageToolIntent('add a watermark to the image',{text:'FLIXO'});
  assert.ok(planned.plan);
  const serialized=JSON.stringify(planned.plan);
  assert.equal(serialized.includes('Blob'),false);
  assert.equal(serialized.includes('ArrayBuffer'),false);
});
