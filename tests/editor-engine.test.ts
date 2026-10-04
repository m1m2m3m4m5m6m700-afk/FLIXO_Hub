import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/lib/editor/document/index.ts';
import { createDocumentEngine } from '../src/lib/editor/engine/index.ts';

const makeDocument = () => createDocument('engine-doc', {
  width: 100, height: 100, colorSpace: 'srgb', bitDepth: 8, alpha: 'premultiplied',
}, [{ id: 'asset-1', kind: 'source', name: 'a.png', mimeType: 'image/png', width: 100, height: 100 }]);

const raster = (id: string, zIndex = 0) => ({
  id, type: 'raster' as const, name: id, parentId: null, zIndex, visible: true, opacity: 1,
  blendMode: 'normal' as const, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  clipToBelow: false, maskId: null, assetId: 'asset-1',
});

test('engine commits immutable transactions with optimistic revision checks', () => {
  const engine = createDocumentEngine(makeDocument());
  const first = engine.addLayer(raster('layer-1'), 1);
  assert.equal(first.version, 2);
  assert.equal(engine.snapshot().version, 2);
  assert.throws(() => engine.updateLayer('layer-1', { opacity: 0.5 }, 1), /STALE_DOCUMENT_VERSION/);
  const second = engine.updateLayer('layer-1', { opacity: 0.5 }, 2);
  assert.equal(second.version, 3);
  assert.equal(engine.snapshot().document.layers[0]?.opacity, 0.5);
});

test('undo and redo advance the engine revision monotonically', () => {
  const engine = createDocumentEngine(makeDocument());
  engine.addLayer(raster('layer-1'), 1);
  engine.updateLayer('layer-1', { opacity: 0.4 }, 2);
  const undo = engine.undo();
  assert.equal(undo?.version, 4);
  assert.equal(engine.snapshot().version, 4);
  assert.equal(engine.snapshot().document.layers[0]?.opacity, 1);
  const redo = engine.redo();
  assert.equal(redo?.version, 5);
  assert.equal(engine.snapshot().version, 5);
  assert.equal(engine.snapshot().document.layers[0]?.opacity, 0.4);
  assert.throws(() => engine.updateLayer('layer-1', { opacity: 0.2 }, 3), /STALE_DOCUMENT_VERSION/);
});

test('invalid mutations fail before state commit', () => {
  const engine = createDocumentEngine(makeDocument());
  assert.throws(() => engine.addLayer({ ...raster('layer-1'), opacity: 2 }, 1), /LAYER_OPACITY_INVALID/);
  assert.equal(engine.snapshot().version, 1);
  assert.equal(engine.snapshot().document.layers.length, 0);
});


test('locked layers reject update, reorder, removal, and generic command mutation', () => {
  const base = makeDocument();
  const engine = createDocumentEngine(base);
  engine.addLayer({ ...raster('locked-layer'), locked: true }, 1);

  assert.throws(
    () => engine.updateLayer('locked-layer', { opacity: 0.5 }, 2),
    /LOCKED_LAYER_MUTATION/,
  );
  assert.throws(
    () => engine.reorderLayer('locked-layer', 4, 2),
    /LOCKED_LAYER_MUTATION/,
  );
  assert.throws(
    () => engine.removeLayer('locked-layer', 2),
    /LOCKED_LAYER_MUTATION/,
  );
  assert.throws(
    () => engine.execute({
      id: 'custom-locked-mutation',
      label: 'Custom locked mutation',
      expectedVersion: 2,
      command: {
        id: 'custom-locked-mutation',
        label: 'Custom locked mutation',
        execute: ({ document }) => ({
          ...document,
          layers: document.layers.map((layer) =>
            layer.id === 'locked-layer' ? { ...layer, visible: false } : layer,
          ),
        }),
        undo: ({ document }) => document,
        serialize: () => ({ id: 'custom-locked-mutation' }),
      },
    }),
    /LOCKED_LAYER_MUTATION/,
  );
  assert.equal(engine.snapshot().document.layers[0]?.locked, true);
});
