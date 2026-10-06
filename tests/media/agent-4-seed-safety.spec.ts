import { deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  let crc = 0xffffffff;
  for (const value of Buffer.concat([typeBytes, data])) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  const crcBytes = Buffer.alloc(4);
  crcBytes.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, typeBytes, data, crcBytes]);
}

function makeOversizedDimensionPng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 1;
  ihdr[9] = 0;
  const row = Buffer.alloc(Math.ceil(width / 8) + 1);
  const raw = Buffer.alloc(row.length * height);
  for (let offset = 0; offset < raw.length; offset += row.length) row.copy(raw, offset);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}

test.describe('Agent 4 seed media-safety closure', () => {
  test('seed rejects empty/mismatched image inputs before rendering', async ({ page }) => {
    await page.goto('/en/seed', { waitUntil: 'domcontentloaded' });
    const input = page.locator('#seed-main-image-input');
    await expect(input).toHaveCount(1);

    await input.setInputFiles({
      name: 'spoof.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not-a-png'),
    });
    await expect(page.getByRole('alert')).toContainText(/signature|magic|safe|invalid|decode/i, { timeout: 10_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await input.setInputFiles({
      name: 'payload.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('plain text payload'),
    });
    await expect(page.getByRole('alert')).toContainText(/unsupported|MIME|image|safe/i, { timeout: 10_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await input.setInputFiles({
      name: 'oversize.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
    });
    await expect(page.getByRole('alert')).toContainText(/maximum size|exceeds|safe/i, { timeout: 10_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await input.setInputFiles({
      name: 'oversized-dimensions.png',
      mimeType: 'image/png',
      buffer: makeOversizedDimensionPng(7000, 6000),
    });
    await expect(page.getByRole('alert')).toContainText(/pixel|dimension|safe|exceeds/i, { timeout: 10_000 });
  });
});
