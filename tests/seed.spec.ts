import { expect, test, type Page, type TestInfo } from './fixtures/universal-runtime-evidence';
import { PNG } from './helpers/image-tool-fixture';

type Canvas2DContext = CanvasRenderingContext2D | null;
type CanvasContextId = '2d' | 'webgl' | 'webgl2' | 'bitmaprenderer' | string;

const canvasLocator = (page: Page) => page.locator('canvas[aria-label="Seed preview"]');
const seedStageLocator = (page: Page) => canvasLocator(page).locator('xpath=ancestor::section[1]');

async function hasWebGl(page: Page) {
  return canvasLocator(page).evaluate((element) => Boolean((element as HTMLCanvasElement).getContext('webgl')));
}

async function gpuPixels(page: Page) {
  return Buffer.from(await canvasLocator(page).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL framebuffer is unavailable.');
    gl.finish();
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const error = gl.getError();
    if (error !== gl.NO_ERROR) throw new Error(`GPU pixel readback failed (WebGL error ${error}).`);
    return Array.from(pixels);
  }));
}

async function expectGpuPixelsEqual(page: Page, expected: Buffer) {
  const actual = await gpuPixels(page);
  expect(actual.equals(expected)).toBe(true);
}

async function expectGpuPixelsDifferent(page: Page, expected: Buffer) {
  const actual = await gpuPixels(page);
  expect(actual.equals(expected)).toBe(false);
}

async function waitForGpuRender(page: Page, previousRevision: string | null = null) {
  const canvas = canvasLocator(page);
  await expect.poll(() => canvas.getAttribute('data-render-revision'), { timeout: 10000 }).not.toBe(previousRevision);
}

async function loadSeed(page: Page, testInfo: TestInfo, requireWebGL = true) {
  await page.goto('/en/seed');
  await expect(page.getByRole('heading', { level: 1, name: 'Seed' })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'seed-fixture.png', mimeType: 'image/png', buffer: PNG });
  await expect(canvasLocator(page)).toBeVisible();
  if (requireWebGL && !(await hasWebGl(page))) {
    testInfo.skip(true, 'Seed GPU assertions require WebGL, which is unavailable in this browser environment.');
  }
  await waitForGpuRender(page, '0');
}

test('Seed: WebGL preview changes pixels and exports a non-empty PNG', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);
  const baseline = await gpuPixels(page);
  const revision = await canvasLocator(page).getAttribute('data-render-revision');
  await page.getByRole('slider', { name: 'brightness' }).fill('50');
  await waitForGpuRender(page, revision);
  await expectGpuPixelsDifferent(page, baseline);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('seed-edited.png');
  expect((await download.createReadStream()) ?? null).toBeTruthy();
});

test('Seed: advanced pipeline controls alter non-destructive state and export', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);
  await expect(page.getByRole('slider', { name: 'Curves' })).toBeVisible();
  await page.getByRole('slider', { name: 'Curves' }).fill('35');
  await page.getByRole('slider', { name: 'Brush strength' }).fill('40');
  await page.getByRole('slider', { name: 'Perspective X' }).fill('10');
  await page.getByRole('slider', { name: 'Perspective Y' }).fill('-8');
  await page.getByRole('slider', { name: 'Lens Blur' }).fill('8');
  await page.getByRole('slider', { name: 'Bokeh' }).fill('20');
  await page.getByRole('spinbutton', { name: 'Healing X' }).fill('1');
  await page.getByRole('spinbutton', { name: 'Healing Y' }).fill('1');

  const exportPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await exportPromise;
  expect(download.suggestedFilename()).toBe('seed-edited.png');
  expect((await download.createReadStream()) ?? null).toBeTruthy();
});

test('Seed: Undo and Redo restore and reapply a GPU color change', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);
  const baseline = await gpuPixels(page);
  const baselineRevision = await canvasLocator(page).getAttribute('data-render-revision');
  await page.getByRole('slider', { name: 'brightness' }).fill('35');
  await waitForGpuRender(page, baselineRevision);
  const edited = await gpuPixels(page);
  expect(edited.equals(baseline)).toBe(false);

  const editedRevision = await canvasLocator(page).getAttribute('data-render-revision');
  await page.getByTestId('button-canvas-undo').click();
  await waitForGpuRender(page, editedRevision);
  await expectGpuPixelsEqual(page, baseline);

  const undoRevision = await canvasLocator(page).getAttribute('data-render-revision');
  const redoButton = page.getByTestId('button-canvas-redo');
  if (await redoButton.count()) await redoButton.click();
  else await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await waitForGpuRender(page, undoRevision);
  await expectGpuPixelsEqual(page, edited);
});

test('Seed: accepts a second image for Double Exposure', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);
  await expect(page.locator('input[aria-label="Double Exposure file"]')).toBeVisible();
  await page.locator('input[aria-label="Double Exposure file"]').setInputFiles({ name: 'exposure.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('slider', { name: 'Exposure opacity' }).fill('60');
  const exportPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await exportPromise;
  expect(download.suggestedFilename()).toBe('seed-edited.png');
});

test('Seed: shows a clear error when GPU rendering is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextId: CanvasContextId, ...args: unknown[]) {
      if (contextId === 'webgl') return null;
      return originalGetContext.call(this, contextId as never, ...args) as Canvas2DContext;
    };
  });

  await page.goto('/en/seed');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'seed-fixture.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('alert')).toContainText('WebGL is not supported');
});

test.describe('SeedTool Real WebGL Engine & Overlay Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/seed');
    await expect(page.getByRole('heading', { level: 1, name: 'Seed' })).toBeVisible();
  });

  test('exposes the frozen canvas overlay contract on the real Seed route', async ({ page }, testInfo) => {
    await loadSeed(page, testInfo);
    await expect(page.getByTestId('button-canvas-zoom-reset')).toHaveText('100%');
    await expect(page.getByTestId('button-canvas-compare')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('button-canvas-fullscreen')).toBeVisible();
  });

  test('applies 0.25x zoom steps and resets to 1x on the actual canvas stage', async ({ page }, testInfo) => {
    await loadSeed(page, testInfo);
    const zoomReset = page.getByTestId('button-canvas-zoom-reset');
    const zoomIn = page.getByTestId('button-canvas-zoom-in');
    const zoomOut = page.getByTestId('button-canvas-zoom-out');

    await zoomIn.click();
    await expect(zoomReset).toHaveText('125%');
    await expect(page.locator('[style*="transform: scale(1.25)"]')).toHaveCount(1);

    await zoomOut.click();
    await expect(zoomReset).toHaveText('100%');
    await zoomOut.click();
    await expect(zoomReset).toHaveText('75%');
    await zoomReset.click();
    await expect(zoomReset).toHaveText('100%');
  });

  test('binds compare lifecycle to the real Seed canvas', async ({ page }, testInfo) => {
    await loadSeed(page, testInfo);
    const compareBtn = page.getByTestId('button-canvas-compare');
    await compareBtn.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1 });
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    await compareBtn.dispatchEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 0 });
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('keeps compare lifecycle safe across keyboard activation and Escape cancellation', async ({ page }, testInfo) => {
    await loadSeed(page, testInfo);
    const compareBtn = page.getByTestId('button-canvas-compare');
    await compareBtn.focus();
    await page.keyboard.down('Space');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.up('Space');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.down('Enter');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('cancels compare on window blur without changing the frozen API', async ({ page }, testInfo) => {
    await loadSeed(page, testInfo);
    const compareBtn = page.getByTestId('button-canvas-compare');
    await compareBtn.focus();
    await page.keyboard.down('Space');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.up('Space');
  });

  test('enters and exits fullscreen on the actual Seed stage when the browser exposes the API', async ({ page }, testInfo) => {
    const fullscreenEnabled = await page.evaluate(() => Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen));
    test.skip(!fullscreenEnabled, 'Fullscreen API is unavailable in this browser environment.');
    await loadSeed(page, testInfo);
    const fullscreenBtn = page.getByTestId('button-canvas-fullscreen');
    const seedStage = seedStageLocator(page);
    await fullscreenBtn.click();
    await expect(fullscreenBtn).toHaveAttribute('aria-label', 'Exit Fullscreen');
    await expect(seedStage).toHaveJSProperty('tagName', 'SECTION');
    await fullscreenBtn.click();
    await expect(fullscreenBtn).toHaveAttribute('aria-label', 'Enter Fullscreen');
  });
});


test.describe('Seed media safety regression', () => {
  const setSeedFile = async (page: Page, file: { name: string; mimeType: string; buffer: Buffer }) => {
    await page.goto('/en/seed');
    await expect(page.getByRole('heading', { level: 1, name: 'Seed' })).toBeVisible();
    await page.locator('#seed-main-image-input').setInputFiles(file);
    return page.getByRole('alert');
  };

  test('rejects fake MIME metadata for a PNG payload', async ({ page }) => {
    const alert = await setSeedFile(page, { name: 'payload.png', mimeType: 'image/jpeg', buffer: PNG });
    await expect(alert).toContainText('Input rejected by Seed File Safety');
    await expect(canvasLocator(page)).not.toHaveAttribute('data-render-revision', '1');
  });

  test('rejects files above the Seed byte ceiling before decoding', async ({ page }) => {
    const alert = await setSeedFile(page, {
      name: 'oversized.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
    });
    await expect(alert).toContainText('file exceeds the maximum size');
  });

  test('rejects excessive declared PNG dimensions before decode', async ({ page }) => {
    const hugeHeader = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(hugeHeader, 0);
    hugeHeader.writeUInt32BE(100000, 16);
    hugeHeader.writeUInt32BE(100000, 20);
    const alert = await setSeedFile(page, { name: 'huge.png', mimeType: 'image/png', buffer: hugeHeader });
    await expect(alert).toContainText('pixel count exceeds policy limit');
  });

  test('rejects a malformed image that spoofs the PNG magic bytes', async ({ page }) => {
    const malformed = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const alert = await setSeedFile(page, { name: 'malformed.png', mimeType: 'image/png', buffer: malformed });
    await expect(alert).toContainText('Unable to decode the image after security validation.');
  });

  test('rejects extension mismatch even when MIME and payload are valid', async ({ page }) => {
    const alert = await setSeedFile(page, { name: 'payload.jpg', mimeType: 'image/png', buffer: PNG });
    await expect(alert).toContainText('file extension does not match MIME type');
  });
});
