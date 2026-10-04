import { expect, test } from '@playwright/test';
import { PNG } from '../helpers/image-tool-fixture';

const CASES = [
  ['background-remover', 'remove background'],
  ['image-upscaler', 'upscale image'],
  ['image-cropper', 'crop image'],
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
  ['image-filters', 'photo filter preset'],
  ['image-watermark', 'add watermark'],
  ['image-text-overlay', 'add text to image'],
  ['image-draw-annotate', 'draw on image'],
  ['image-redaction', 'redact image'],
] as const;

async function setupAgent(page: import('@playwright/test').Page, prompt: string) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const posts: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.method() !== 'GET') posts.push(request.url());
  });

  await page.goto('/agent');
  const main = page.locator('main[lang]');
  await expect(main).toBeVisible();
  await page.locator('#agent-prompt').fill(prompt);
  await page.locator('#agent-file').setInputFiles({
    name: 'fixture.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByRole('button', { name: /إنشاء الخطة|Build plan/i }).click();
  return { consoleErrors, pageErrors, posts };
}

for (const [expectedTool, prompt] of CASES) {
  test('Agent 20/20 local workflow — ' + expectedTool, async ({ page }) => {
    const evidence = await setupAgent(page, prompt);
    await expect(page.locator('[aria-label="agent-plan"]')).toBeVisible();
    await expect(page.locator('[aria-label="agent-plan"]')).toContainText(expectedTool);

    const execute = page.getByRole('button', { name: /تنفيذ|Execute/i });
    await expect(execute).toBeDisabled();

    const confirm = page.getByRole('checkbox');
    await confirm.check();
    await expect(execute).toBeEnabled();
    await execute.click();

    await expect(page.locator('[aria-label="agent-result"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /تنزيل النتيجة|Download result/i })).toBeVisible();
    expect(evidence.consoleErrors).toEqual([]);
    expect(evidence.pageErrors).toEqual([]);
    expect(evidence.posts).toEqual([]);
  });
}

test('Agent confirmation denial is fail-closed', async ({ page }) => {
  await setupAgent(page, 'sharpen image');
  const execute = page.getByRole('button', { name: /تنفيذ|Execute/i });
  await expect(execute).toBeDisabled();
  await expect(page.locator('[aria-label="agent-result"]')).toHaveCount(0);
});

test('Agent Arabic RTL workflow is usable', async ({ page }) => {
  const evidence = await setupAgent(page, 'زيادة حدة الصورة');
  await expect(page.locator('main[lang="ar"]')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('[aria-label="agent-plan"]')).toContainText('image-sharpen');
  expect(evidence.consoleErrors).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
  expect(evidence.posts).toEqual([]);
});

test('Agent mobile Arabic viewport has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/agent');
  const main = page.locator('main[lang="ar"]');
  await expect(main).toHaveAttribute('dir', 'rtl');
  await expect(main).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('Agent exposes a cancellation control while execution is busy', async ({ page }) => {
  await page.goto('/agent');
  await page.locator('#agent-prompt').fill('blur image');
  await page.locator('#agent-file').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: /إنشاء الخطة|Build plan/i }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /تنفيذ|Execute/i }).click();
  await expect(page.getByRole('button', { name: /إلغاء|Cancel/i })).toBeVisible({ timeout: 2_000 });
  await page.getByRole('button', { name: /إلغاء|Cancel/i }).click();
  await expect(page.locator('[aria-label="agent-result"]')).toHaveCount(0);
});
