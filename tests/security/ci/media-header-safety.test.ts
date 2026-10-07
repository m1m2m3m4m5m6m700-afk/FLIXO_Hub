import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readRasterDimensionsFromHeader } from '../../../src/lib/contracts/file-safety.ts';

const writeU32BE = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
};

test('PNG dimensions are established from the header before decode', () => {
  const header = new Uint8Array(24);
  header.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a], 0);
  writeU32BE(header, 16, 40_000);
  writeU32BE(header, 20, 30_000);
  assert.deepEqual(readRasterDimensionsFromHeader(header, 'image/png'), { width: 40_000, height: 30_000 });
});

test('JPEG SOF dimensions are established without decoding the image', () => {
  const header = new Uint8Array([
    0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0x75,0x30,0x9c,0x40,0x03,0x01,0x11,0x00,0x02,0x11,0x01,0xff,
  ]);
  assert.deepEqual(readRasterDimensionsFromHeader(header, 'image/jpeg'), { width: 40_000, height: 30_000 });
});

test('WebP VP8X dimensions are established from the bounded header', () => {
  const header = new Uint8Array(30);
  header.set([0x52,0x49,0x46,0x46], 0);
  header.set([0x57,0x45,0x42,0x50], 8);
  header.set([0x56,0x50,0x38,0x58], 12);
  const widthMinusOne = 39_999;
  const heightMinusOne = 29_999;
  header[24] = widthMinusOne & 0xff;
  header[25] = (widthMinusOne >>> 8) & 0xff;
  header[26] = (widthMinusOne >>> 16) & 0xff;
  header[27] = heightMinusOne & 0xff;
  header[28] = (heightMinusOne >>> 8) & 0xff;
  header[29] = (heightMinusOne >>> 16) & 0xff;
  assert.deepEqual(readRasterDimensionsFromHeader(header, 'image/webp'), { width: 40_000, height: 30_000 });
});

test('unknown raster headers fail closed instead of permitting an unbounded decode', () => {
  const header = new Uint8Array(64);
  assert.equal(readRasterDimensionsFromHeader(header, 'image/png'), undefined);
  assert.equal(readRasterDimensionsFromHeader(header, 'image/jpeg'), undefined);
  assert.equal(readRasterDimensionsFromHeader(header, 'image/webp'), undefined);
});

test('canonical executor keeps image-effects on the cancellable worker path', async () => {
  const source = await import('../../../src/lib/execution/canonical-executor.ts');
  const fs = await import('node:fs/promises');
  const text = await fs.readFile(new URL('../../../src/lib/execution/canonical-executor.ts', import.meta.url), 'utf8');
  assert.match(text, /IMAGE_EFFECTS_WORKER_REQUIRED/u);
  assert.doesNotMatch(text, /executeImageEffectsFallback/u);
  assert.match(text, /readRasterDimensionsFromHeader\(header, input\.blob\.type\)/u);
  void source;
});
