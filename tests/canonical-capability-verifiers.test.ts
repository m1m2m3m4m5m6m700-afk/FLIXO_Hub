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
    private _srcObject: Blob | null = null;
    private _src = '';

    set srcObject(value: Blob | null) {
      this._srcObject = value;
      queueMicrotask(() => {
        const meta = this._srcObject ? videoMetadata.get(this._srcObject) : undefined;
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

    get srcObject() {
      return this._srcObject;
    }

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
    currentVerificationInput = effectsInput;
    assert.equal(await definition('image-effects').verifier(effectsInput, effectsOutput, { contrast: 120 }), true);
    assert.equal(await definition('image-effects').verifier(effectsInput, effectsOutput, { brightness: 100 }), false);

    const bgInput = new Blob(['bg-input'], { type: 'image/png' });
    const bgOutput = new Blob(['bg-output'], { type: 'image/png' });
    imageDimensions.set(bgInput, { width: 32, height: 32 });
    imageDimensions.set(bgOutput, { width: 32, height: 32 });
    currentVerificationInput = bgInput;
    assert.equal(await definition('background-remover').verifier(bgInput, bgOutput, {}), true);
    assert.equal(await definition('background-remover').verifier(bgInput, bgInput, {}), false);

    const compressedInput = new Blob(['x'.repeat(1000)], { type: 'image/png' });
    const compressedOutput = new Blob(['x'.repeat(400)], { type: 'image/webp' });
    assert.equal(await definition('image-compressor').verifier(compressedInput, compressedOutput, { targetSizeKB: 1 }), true);
    assert.equal(
      await definition('image-compressor').verifier(compressedInput, new Blob(['x'.repeat(1200)], { type: 'image/webp' }), {}),
      false,
    );

    const converted = new Blob(['converted'], { type: 'image/webp' });
    imageDimensions.set(converted, { width: 100, height: 50 });
    assert.equal(await definition('image-converter').verifier(input, converted, { format: 'image/webp' }), true);

    const wrongDimensions = new Blob(['converted'], { type: 'image/webp' });
    imageDimensions.set(wrongDimensions, { width: 99, height: 50 });
    assert.equal(await definition('image-converter').verifier(input, wrongDimensions, { format: 'image/webp' }), false);

    const videoIds = ['video-trimmer', 'video-cropper', 'video-resizer', 'video-compressor'];
    for (const id of videoIds) {
      const candidateInput = new Blob(['candidate-video-input'.repeat(2)], { type: 'video/webm' });
      const candidateOutput = new Blob(['candidate-video-output'], { type: 'video/webm' });
      videoMetadata.set(candidateInput, { width: 320, height: 180, duration: 2 });
      videoMetadata.set(candidateOutput, {
        width: id === 'video-resizer' || id === 'video-cropper' ? 320 : 320,
        height: id === 'video-resizer' || id === 'video-cropper' ? 180 : 180,
        duration: id === 'video-trimmer' ? 1.9 : 2,
      });
      currentVerificationInput = null;
      const parameters = id === 'video-trimmer'
        ? { startSec: 0, endSec: 1.9 }
        : id === 'video-cropper'
          ? { x: 0, y: 0, width: 9999, height: 9999 }
          : {};
      assert.equal(await definition(id).verifier(candidateInput, candidateOutput, parameters), true, id);
      if (id === 'video-compressor') {
        const oversizedOutput = new Blob(['candidate-video-output'.repeat(10)], { type: 'video/webm' });
        videoMetadata.set(oversizedOutput, { width: 320, height: 180, duration: 2 });
        assert.equal(await definition(id).verifier(candidateInput, oversizedOutput, parameters), false, id);
      }
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


test('canonical MVP contains exactly ten executable local capabilities with complete contracts', async () => {
  const { MVP_EXECUTABLE_TOOL_IDS, CAPABILITY_DEFINITIONS } = await import('../src/config/manual-capability-definition.ts');
  assert.equal(MVP_EXECUTABLE_TOOL_IDS.length, 10);
  assert.equal(new Set(MVP_EXECUTABLE_TOOL_IDS).size, 10);
  assert.equal(CAPABILITY_DEFINITIONS.length, 10);
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
