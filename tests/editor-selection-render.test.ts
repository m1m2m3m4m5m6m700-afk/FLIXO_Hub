import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSelection, combineSelections } from '../src/lib/editor/selection';
import { createRenderGraph } from '../src/lib/editor/render';
import { createRenderSchedule } from '../src/lib/editor/render/scheduler';
import { createRenderCache, createRenderCacheKey } from '../src/lib/editor/render/cache';

test('selection combines bounded coverage deterministically', () => {
  const a=createSelection('a',2,1,[0,0.5]);
  const b=createSelection('b',2,1,[0.5,1]);
  assert.deepEqual(Array.from(combineSelections(a,b,'add').coverage.values), [0.5,1]);
  assert.deepEqual(Array.from(combineSelections(a,b,'subtract').coverage.values), [0,0]);
});

test('render scheduler follows graph order and rejects unsupported backend', () => {
  const graph=createRenderGraph([
    {id:'src',operation:'source',parameters:{},backends:['canvas2d'],dependencies:[]},
    {id:'out',operation:'output',parameters:{},backends:['canvas2d'],dependencies:['src']},
  ], 'out');
  assert.deepEqual(createRenderSchedule(graph,'canvas2d').nodes.map(n=>n.id), ['src','out']);
  assert.throws(()=>createRenderSchedule(graph,'webgpu'), /RENDER_BACKEND_UNSUPPORTED/);
});

test('render cache stays within byte budget', () => {
  const cache=createRenderCache(10);
  const node={id:'n',operation:'x',parameters:{},backends:['canvas2d'] as const,inputs:[]};
  const key=createRenderCacheKey(node);
  cache.set({key,backend:'canvas2d',value:'a',bytes:8});
  assert.equal(cache.stats().bytes, 8);
  cache.set({key:'b',backend:'canvas2d',value:'b',bytes:8});
  assert.ok(cache.stats().bytes <= 10);
});

