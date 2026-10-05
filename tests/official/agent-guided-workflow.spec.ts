import { expect, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';

const ONE_BY_ONE_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function attachFixture(page: Page) {
  await page.getByTestId('agent-guided-file').setInputFiles({
    name: 'fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(ONE_BY_ONE_PNG, 'base64'),
  });
}

test.describe('Agent Guided MVP workflow', () => {
  test('English request executes through plan, confirmation and canonical result', async ({ page }) => {
    await page.goto('/en');
    const workspace = page.getByRole('region', { name: 'Agent Guided MVP' });
    await expect(workspace).toBeVisible();

    await workspace.getByTestId('agent-guided-prompt').fill('compress this image to WebP');
    await attachFixture(page);
    await workspace.getByRole('button', { name: 'Build plan' }).click();

    await expect(workspace.getByTestId('agent-guided-tool-id')).toHaveText('image-compressor');
    await expect(workspace.getByText('Confirmation required before execution.')).toBeVisible();

    await workspace.getByRole('button', { name: 'Confirm execution' }).click();
    await workspace.getByRole('button', { name: 'Run now' }).click();

    const result = workspace.getByRole('status', { name: 'Verified result' });
    await expect(result).toBeVisible({ timeout: 15_000 });
    await expect(result.getByRole('link', { name: 'Download result' })).toHaveAttribute('download', /-compressed\.webp$/);
  });

  test('Arabic request executes through the same canonical path', async ({ page }) => {
    await page.goto('/ar');
    const workspace = page.getByRole('region', { name: 'Agent Guided MVP' });
    await expect(workspace).toBeVisible();

    await workspace.getByTestId('agent-guided-prompt').fill('اضغط هذه الصورة بصيغة webp');
    await attachFixture(page);
    await workspace.getByRole('button', { name: 'إنشاء الخطة' }).click();

    await expect(workspace.getByTestId('agent-guided-tool-id')).toHaveText('image-compressor');
    await workspace.getByRole('button', { name: 'تأكيد التنفيذ' }).click();
    await workspace.getByRole('button', { name: 'تنفيذ الآن' }).click();

    const result = workspace.getByRole('status', { name: 'نتيجة موثقة' });
    await expect(result).toBeVisible({ timeout: 15_000 });
    await expect(result.getByRole('link', { name: 'تنزيل النتيجة' })).toHaveAttribute('download', /-compressed\.webp$/);
  });

  test('unsupported operation fails closed and exposes manual fallback', async ({ page }) => {
    await page.goto('/en');
    const workspace = page.getByRole('region', { name: 'Agent Guided MVP' });
    await workspace.getByTestId('agent-guided-prompt').fill('create a 3D video from this image');
    await attachFixture(page);
    await workspace.getByRole('button', { name: 'Build plan' }).click();

    await expect(workspace.getByRole('alert')).toBeVisible();
    await expect(workspace.getByRole('alert')).toContainText(/could not complete|unsupported|No admitted FLIXO MVP capability/i);
    await expect(workspace.getByRole('alert').getByRole('link', { name: 'Use the manual tools' })).toHaveAttribute('href', '/en/tools');
  });
});
