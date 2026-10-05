import assert from 'node:assert/strict';
import { test } from 'node:test';

const { CAPABILITY_DEFINITIONS } = await import('../src/config/manual-capability-definition.ts');

function definition(id: string) {
  const result = CAPABILITY_DEFINITIONS.find((item) => item.id === id);
  assert.ok(result, id);
  return result;
}

test('canonical MVP capability verifiers accept measurable valid artifacts and reject neutral effects', async () => {
  const globals = globalThis as typeof globalThis & {
    createImageBitmap?: unknown;
    document?: unknown;
  };
  const originalCreateImageBitmap = globals.createImageBitmap;
  const originalDocument = globals.document;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  const imageDimensions = new WeakMap<Blob, { width: number; height: number }>();
  const urlBlobs = new Map<string, Blob>();
  const videoMetadata = new WeakMap<Blob, { width: number; height: number; duration: number }>();
  const bitmapSources = new WeakMap<object, Blob>();
  let activeBitmap: object | null = null;

  globals.createImageBitmap = async (blob: Blob) => {
    const bitmap = {
      width: imageDimensions.get(blob)?.width ?? 1,
      height: imageDimensions.get(blob)?.height ?? 1,
      close() {},
    };
    bitmapSources.set(bitmap, blob);
    return bitmap;
  };

  URL.createObjectURL = ((blob: Blob) => {
    const url = 'blob:test-' + String(urlBlobs.size + 1);
    urlBlobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;

  URL.revokeObjectURL = ((url: string) => {
    urlBlobs.delete(url);
  }) as typeof URL.revokeObjectURL;

  let currentVerificationInput: Blob | null = null;
  const canvasContext = {
    clearRect() {},
    drawImage(bitmap: object) {
      activeBitmap = bitmap;
    },
    getImageData() {
      const data = new Uint8ClampedArray(32 * 32 * 4);
      const source = activeBitmap ? bitmapSources.get(activeBitmap) : undefined;
      if (source && source === currentVerificationInput) {
        for (let index = 0; index < data.length; index += 4) {
          data[index] = 16;
          data[index + 1] = 32;
          data[index + 2] = 64;
          data[index + 3] = 255;
        }
      } else {
        for (let index = 0; index < data.length; index += 4) {
          data[index] = 220;
          data[index + 1] = 160;
          data[index + 2] = 80;
          data[index + 3] = 255;
        }
      }
      return { data };
    },
  };

  class FakeVideo {
    duration = 0;
    videoWidth = 0;
    videoHeight = 0;
    preload = '';
    onloadedmetadata: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = '';

    set src(value: string) {
      this._src = value;
      queueMicrotask(() => {
        const blob = urlBlobs.get(this._src);
        const meta = blob ? videoMetadata.get(blob) : undefined;
        if (!meta) {
          this.onerror?.();
          return;
        }
        this.duration = meta.duration;
        this.videoWidth = meta.width;
        this.videoHeight = meta.height;
        this.onloadedmetadata?.();
      });
    }

    get src() {
      return this._src;
    }

    removeAttribute() {
      this._src = '';
    }

    load() {}
  }

  globals.document = {
    createElement(tag: string) {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext() {
            return canvasContext;
          },
        };
      }
      if (tag === 'video') return new FakeVideo();
      throw new Error('Unsupported fake element: ' + tag);
    },
  };

  try {
    const input = new Blob(['input'], { type: 'image/png' });
    const output = new Blob(['output'], { type: 'image/png' });
    currentVerificationInput = input;
    imageDimensions.set(input, { width: 100, height: 50 });
    imageDimensions.set(output, { width: 200, height: 100 });
    assert.equal(await definition('image-upscaler').verifier(input, output, { scale: 2 }), true);

    imageDimensions.set(output, { width: 50, height: 50 });
    assert.equal(await definition('image-cropper').verifier(input, output, { aspectRatio: '1:1' }), true);

    const effectsInput = new Blob(['effects-input'], { type: 'image/png' });
    const effectsOutput = new Blob(['effects-output'], { type: 'image/png' });
    imageDimensions.set(effectsInput, { width: 32, height: 32 });
    imageDimensions.set(effectsOutput, { width: 32, height: 32 });
    assert.equal(await definition('image-effects').verifier(effectsInput, effectsOutput, { contrast: 120 }), true);
    assert.equal(await definition('image-effects').verifier(effectsInput, effectsOutput, { brightness: 100 }), false);

    const bgInput = new Blob(['bg-input'], { type: 'image/png' });
    const bgOutput = new Blob(['bg-output'], { type: 'image/png' });
    imageDimensions.set(bgInput, { width: 32, height: 32 });
    imageDimensions.set(bgOutput, { width: 32, height: 32 });
    assert.equal(await definition('background-remover').verifier(bgInput, bgOutput, {}), true);

    const compressedInput = new Blob(['x'.repeat(1000)], { type: 'image/png' });
    const compressedOutput = new Blob(['x'.repeat(400)], { type: 'image/webp' });
    assert.equal(await definition('image-compressor').verifier(compressedInput, compressedOutput, { targetSizeKB: 1 }), true);

    const converted = new Blob(['converted'], { type: 'image/webp' });
    assert.equal(await definition('image-converter').verifier(input, converted, { format: 'image/webp' }), true);

    for (const id of [
      'image-rotate',
      'image-flip-horizontal',
      'image-flip-vertical',
      'image-brightness',
      'image-contrast',
      'image-saturation',
      'image-grayscale',
      'image-invert',
      'image-sepia',
      'image-blur',
      'image-sharpen',
      'image-resizer',
      'image-hue',
      'image-pixelate',
    ]) {
      const candidateInput = new Blob(['candidate-input'], { type: 'image/png' });
      const candidateOutput = new Blob(['candidate-output'], { type: 'image/png' });
      imageDimensions.set(candidateInput, { width: 32, height: 32 });
      imageDimensions.set(candidateOutput, { width: 32, height: 32 });
      currentVerificationInput = candidateInput;
      assert.equal(await definition(id).verifier(candidateInput, candidateOutput, {}), true, id);
      assert.equal(await definition(id).verifier(candidateInput, candidateInput, {}), false, id + ':neutral-output');
    }
  } finally {
    if (originalCreateImageBitmap === undefined) delete globals.createImageBitmap;
    else globals.createImageBitmap = originalCreateImageBitmap;
    if (originalDocument === undefined) delete globals.document;
    else globals.document = originalDocument;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});


test('canonical MVP contains exactly twenty executable browser-local capabilities with complete contracts', async () => {
  const { MVP_EXECUTABLE_TOOL_IDS, CAPABILITY_DEFINITIONS } = await import('../src/config/manual-capability-definition.ts');
  assert.equal(MVP_EXECUTABLE_TOOL_IDS.length, 20);
  assert.equal(new Set(MVP_EXECUTABLE_TOOL_IDS).size, 20);
  assert.equal(CAPABILITY_DEFINITIONS.length, 20);
  for (const id of MVP_EXECUTABLE_TOOL_IDS) {
    const item = definition(id);
    assert.equal(item.state, 'EXECUTABLE');
    assert.equal(item.executionMode, 'LOCAL');
    assert.equal(item.requirements.network, false);
    assert.equal(item.recovery.maxAttempts, 3);
    assert.equal(item.recovery.replanOnFailure, false);
    assert.equal(item.operational.executorId, id);
    assert.equal(item.operational.outputContractId, id);
    assert.ok(item.intents.length > 0);
    assert.ok(item.parameterSchema);
    assert.ok(item.verifier);
  }
});
