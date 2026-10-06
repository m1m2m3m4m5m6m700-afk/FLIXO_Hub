import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from './fixtures/universal-runtime-evidence';
import { PNG } from './helpers/image-tool-fixture';

const targets = [
  { path: '/en/seed', input: '#seed-main-image-input' },
  { path: '/en/pix', input: '#pix-image-file' },
] as const;

async function openTarget(page: Page, target: (typeof targets)[number], file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto(target.path);
  await page.locator(target.input).setInputFiles(file);
}

for (const target of targets) {
  test(`RT-12 ${target.path} rejects fake MIME`, async ({ page }) => {
    await openTarget(page, target, { name: 'fake.txt', mimeType: 'text/plain', buffer: PNG });
    await expect(page.getByRole('alert')).toContainText(/unsupported input MIME type|Input rejected by File Safety/i);
  });

  test(`RT-12 ${target.path} rejects signature mismatch`, async ({ page }) => {
    await openTarget(page, target, { name: 'spoof.png', mimeType: 'image/png', buffer: Buffer.from('not-a-png-payload') });
    await expect(page.getByRole('alert')).toContainText(/magic|signature|Input rejected by File Safety/i);
  });

  test(`RT-12 ${target.path} rejects oversized input`, async ({ page }) => {
    await openTarget(page, target, { name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.concat([PNG, Buffer.alloc(25 * 1024 * 1024)]) });
    await expect(page.getByRole('alert')).toContainText(/maximum size|larger|exceeds/i);
  });

  test(`RT-12 ${target.path} rejects excessive decoded pixels`, async ({ page }) => {
    await page.addInitScript(() => {
      window.createImageBitmap = (async () => ({ width: 7001, height: 6000, close() {} } as ImageBitmap)) as typeof window.createImageBitmap;
    });
    await openTarget(page, target, { name: 'oversized-pixels.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('alert')).toContainText(/maximum pixel|too large|Input rejected by File Safety/i);
  });

  test(`RT-12 ${target.path} rejects malformed image payload`, async ({ page }) => {
    const malformed = Buffer.concat([PNG.subarray(0, 16), Buffer.from('malformed-payload')]);
    await openTarget(page, target, { name: 'malformed.png', mimeType: 'image/png', buffer: malformed });
    await expect(page.getByRole('alert')).toContainText(/decoder|decode|Unable to validate/i);
  });

  test(`RT-12 ${target.path} rejects extension mismatch`, async ({ page }) => {
    await openTarget(page, target, { name: 'wrong-extension.jpg', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('alert')).toContainText(/extension|Input rejected by File Safety/i);
  });
}

test('RT-12 static guard: sensitive input boundaries do not use MIME-prefix admission', async () => {
  const sourceFiles = [
    'src/tools/seed/index.tsx',
    'src/tools/pix/index.tsx',
    'src/components/image-tool/ToolWorkbench.tsx',
    'src/tools/image-compressor/engine.ts',
    'src/tools/image-compressor/file-safety.ts',
  ];
  for (const sourcePath of sourceFiles) {
    const source = await readFile(sourcePath, 'utf8');
    expect(source).not.toContain("file.type.startsWith('image/')");
    expect(source).not.toContain('file.type.startsWith("image/")');
  }
}
