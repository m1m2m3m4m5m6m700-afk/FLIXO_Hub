import { expect, test } from '../fixtures/universal-runtime-evidence';

const TOOLS = [
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
  'image-resizer',
  'image-rotate-flip',
  'image-brightness-contrast',
  'image-saturation-hue',
  'image-exposure',
  'image-highlights-shadows',
  'image-sharpen',
  'image-blur',
  'image-grayscale-duotone',
  'image-filters',
  'image-watermark',
  'image-text-overlay',
  'image-draw-annotate',
  'image-redaction',
] as const;

test.describe('Production browser verification', () => {
  test('official home, Arabic RTL, mobile, all 20 tools, links, and runtime are clean', async ({ page, baseURL }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requestFailures: string[] = [];
    const failedResponses: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });

    expect(baseURL).toBeTruthy();

    const root = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(root?.status()).toBe(200);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const links = await page.locator('a[href]').evaluateAll((anchors) =>
      anchors.map((anchor) => (anchor as HTMLAnchorElement).href).filter(Boolean),
    );
    const origin = new URL(baseURL!);
    const internalLinks = [...new Set(
      links
        .map((href) => new URL(href, baseURL!))
        .filter((url) => url.origin === origin.origin && !url.hash)
        .map((url) => url.toString()),
    )];
    for (const url of internalLinks) {
      const response = await page.request.get(url, { timeout: 20_000, failOnStatusCode: false });
      expect(response.status(), `Broken internal link: ${url}`).toBeLessThan(400);
    }

    const arabic = await page.goto('/ar/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(arabic?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const mobileLayout = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(mobileLayout.scrollWidth).toBeLessThanOrEqual(mobileLayout.clientWidth + 1);

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const tool of TOOLS) {
      const response = await page.goto(`/en/${tool}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      expect(response?.status(), `Tool route failed: ${tool}`).toBe(200);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('input[type="file"]').first()).toHaveCount(1);
      await expect(page.getByRole('button').filter({ hasText: /run tool|compress image|run/i }).first()).toBeVisible();
    }

    expect(consoleErrors, `Blocking console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Blocking page errors: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(requestFailures, `Request failures: ${requestFailures.join(' | ')}`).toEqual([]);
    expect(failedResponses, `Failed responses: ${failedResponses.join(' | ')}`).toEqual([]);
  });
});
