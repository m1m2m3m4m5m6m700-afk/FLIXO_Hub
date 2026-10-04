import { expect, test, type Page } from '@playwright/test';
import { PNG } from '../helpers/image-tool-fixture';

const CASES = [
  ['background-remover', 'remove background'],
  ['image-upscaler', 'upscale image'],
  ['image-cropper', 'crop image to square'],
  ['image-compressor', 'compress image'],
  ['image-converter', 'convert this image to webp'],
  ['image-effects', 'photo effects'],
  ['image-resizer', 'resize image'],
  ['image-rotate-flip', 'rotate and flip image'],
  ['image-brightness-contrast', 'brightness contrast'],
  ['image-saturation-hue', 'saturation hue'],
  ['image-exposure', 'exposure adjustment'],
  ['image-highlights-shadows', 'highlights and shadows'],
  ['image-sharpen', 'sharpen image'],
  ['image-blur', 'blur image'],
  ['image-grayscale-duotone', 'grayscale duotone'],
  ['image-filters', 'photo filters'],
  ['image-watermark', 'add watermark'],
  ['image-text-overlay', 'add text to image'],
  ['image-draw-annotate', 'draw on image'],
  ['image-redaction', 'redact image'],
] as const;

async function setupAgent(page: Page, prompt: string) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const nonGetRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.method() !== 'GET') nonGetRequests.push(request.method() + ' ' + request.url());
  });

  await page.goto('/agent', { waitUntil: 'domcontentloaded' });
  const main = page.locator('main').last();
  await expect(main).toBeVisible();
  await page.locator('#agent-prompt').fill(prompt);
  await page.locator('#agent-file').setInputFiles({
    name: 'fixture.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByRole('button', { name: /إنشاء الخطة|Build plan/i }).click();
  await expect(page.locator('[aria-label="agent-plan"]')).toBeVisible();
  return { consoleErrors, pageErrors, nonGetRequests };
}

for (const [expectedTool, prompt] of CASES) {
  test('Agent 20/20 local workflow — ' + expectedTool, async ({ page }) => {
    const evidence = await setupAgent(page, prompt);

    await expect(page.locator('[aria-label="agent-plan"]')).toContainText(expectedTool);
    const confirmation = page.getByRole('checkbox');
    const execute = page.getByRole('button', { name: /تنفيذ|Execute/i });

    await expect(confirmation).not.toBeChecked();
    await expect(execute).toBeDisabled();
    await expect(page.locator('[aria-label="agent-result"]')).toHaveCount(0);

    await confirmation.check();
    await expect(execute).toBeEnabled();
    await execute.click();

    await expect(page.locator('[aria-label="agent-result"]')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole('link', { name: /تنزيل النتيجة|Download result/i })).toBeVisible();
    expect(evidence.consoleErrors).toEqual([]);
    expect(evidence.pageErrors).toEqual([]);
    expect(evidence.nonGetRequests).toEqual([]);
  });
}

test('Agent confirmation denial is fail-closed', async ({ page }) => {
  const evidence = await setupAgent(page, 'sharpen image');
  const execute = page.getByRole('button', { name: /تنفيذ|Execute/i });
  await expect(execute).toBeDisabled();
  await expect(page.locator('[aria-label="agent-result"]')).toHaveCount(0);
  expect(evidence.consoleErrors).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});

test('Agent Arabic RTL workflow is usable', async ({ page }) => {
  const evidence = await setupAgent(page, 'زيادة حدة الصورة');
  const main = page.locator('main').last();
  await expect(main).toHaveAttribute('lang', 'ar');
  await expect(main).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('[aria-label="agent-plan"]')).toContainText('image-sharpen');
  expect(evidence.consoleErrors).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
  expect(evidence.nonGetRequests).toEqual([]);
});

test('Agent mobile Arabic viewport has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/agent', { waitUntil: 'domcontentloaded' });
  const main = page.locator('main').last();
  await expect(main).toHaveAttribute('lang', 'ar');
  await expect(main).toHaveAttribute('dir', 'rtl');
  await expect(main).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('Agent exposes cancellation and prevents post-cancel result', async ({ page }) => {
  // Force the async canvas export to remain pending long enough to exercise the
  // actual AbortController path instead of racing a very fast local operation.
  await page.addInitScript(() => {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function delayedToBlob(callback, type, quality) {
      return originalToBlob.call(this, (blob) => {
        window.setTimeout(() => callback(blob), 750);
      }, type, quality);
    };
  });
  await page.goto('/agent', { waitUntil: 'domcontentloaded' });
  await page.locator('#agent-prompt').fill('blur image');
  await page.locator('#agent-file').setInputFiles({
    name: 'fixture.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByRole('button', { name: /إنشاء الخطة|Build plan/i }).click();
  await expect(page.locator('[aria-label="agent-plan"]')).toBeVisible();
  await page.getByRole('checkbox').check();

  const execute = page.getByRole('button', { name: /تنفيذ|Execute/i });
  await execute.click();
  const cancel = page.getByRole('button', { name: /إلغاء|Cancel/i });
  await expect(cancel).toBeVisible({ timeout: 3_000 });
  await cancel.click();
  await expect(page.locator('[aria-label="agent-result"]')).toHaveCount(0);
});
