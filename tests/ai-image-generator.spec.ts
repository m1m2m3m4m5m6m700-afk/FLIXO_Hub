import { expect, test } from './fixtures/universal-runtime-evidence';

test('ai-image-generator: is unavailable in the model-free initial release and makes no inference request', async ({ page }) => {
  let endpointCalls = 0;
  await page.route('**/api/ai/image', async (route) => {
    endpointCalls += 1;
    await route.abort();
  });

  await page.goto('/en/ai-image-generator');
  await expect(page.getByRole('heading', { level: 2, name: 'AI Image Generator' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Image generation is unavailable in the model-free initial release.');
  await expect(page.getByRole('button', { name: 'Generate image' })).toHaveCount(0);
  expect(endpointCalls).toBe(0);
});

test('ai-image-generator: Arabic route explains the model-free limitation', async ({ page }) => {
  await page.goto('/ar/ai-image-generator');
  await expect(page.getByRole('status')).toContainText('غير متاحة في الإصدار الأول الذي يعمل بلا نموذج');
  await expect(page.getByRole('button', { name: 'إنشاء صورة' })).toHaveCount(0);
});
