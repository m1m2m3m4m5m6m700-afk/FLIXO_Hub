import { expect, test, type Page } from '@playwright/test';

const PNG_FIXTURE = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAPUlEQVR42mP4z8DwHwwZ/oMBAwOYxQBD/xkaHBT+Kzg0/HdoUPh/IsXoP4OIhs1/Gw2R/ynTTvz/sCXgPwDaSiSJ4dCj1wAAAABJRU5ErkJggg==';
const IMAGE_TOOL_IDS = [
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
] as const;
const VIDEO_TOOL_IDS = [
  'video-trimmer',
  'video-cropper',
  'video-resizer',
  'video-compressor',
] as const;

function imageFixture() {
  return {
    name: 'flixo-release-fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_FIXTURE, 'base64'),
  };
}

async function videoFixture(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas context unavailable');
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true });
    });
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.start(100);

    const start = performance.now();
    while (performance.now() - start < 800) {
      const t = performance.now() - start;
      context.fillStyle = '#123';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#fff';
      context.fillRect(20 + Math.round((t / 800) * 200), 60, 40, 40);
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: 'video/webm' });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  return {
    name: 'flixo-release-fixture.webm',
    mimeType: 'video/webm',
    buffer: Buffer.from(bytes),
  };
}

async function executeManualImage(page: Page, toolId: (typeof IMAGE_TOOL_IDS)[number]) {
  await page.goto('/en/' + toolId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1,h2').filter({ hasText: /./ }).first()).toBeVisible();
  const fileInput = page.locator('input[type=file]').first();
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles(imageFixture());

  if (toolId === 'image-cropper') {
    await page.getByRole('textbox', { name: 'Crop width' }).fill('4');
    await page.getByRole('textbox', { name: 'Crop height' }).fill('4');
    await page.getByRole('textbox', { name: 'Output width' }).fill('4');
    await page.getByRole('textbox', { name: 'Output height' }).fill('4');
  }

  const runButton = page.getByRole('button', { name: toolId === 'image-compressor' ? /Compress image/i : /Run tool/i });
  await expect(runButton).toBeEnabled({ timeout: 10_000 });
  await runButton.click();
  await expect(page.locator('a[download]').first()).toBeVisible({ timeout: 20_000 });
}

async function executeManualVideo(page: Page, toolId: (typeof VIDEO_TOOL_IDS)[number]) {
  await page.goto('/en/' + toolId, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Local video processing/i })).toBeVisible();
  const fileInput = page.getByLabel('Choose video');
  await fileInput.setInputFiles(await videoFixture(page));
  await expect(page.getByRole('button', { name: /Process video/i })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole('button', { name: /Process video/i }).click();
  await expect(page.locator('a[download]').first()).toBeVisible({ timeout: 30_000 });
}

async function planAndExecuteAgent(page: Page, prompt: string, expectedToolId: string, language: 'ar' | 'en', fixture: unknown) {
  await page.goto('/agent', { waitUntil: 'domcontentloaded' });
  const main = page.locator('main').last();

  if (language === 'ar') {
    const direction = await main.getAttribute('dir');
    if (direction !== 'rtl') await page.getByRole('button', { name: /العربية/i }).click();
    await expect(main).toHaveAttribute('dir', 'rtl');
    await expect(main).toHaveAttribute('lang', 'ar');
  } else {
    const direction = await main.getAttribute('dir');
    if (direction !== 'ltr') await page.getByRole('button', { name: /English/i }).click();
    await expect(main).toHaveAttribute('dir', 'ltr');
  }

  await page.locator('#agent-prompt').fill(prompt);
  await page.locator('#agent-file').setInputFiles(fixture as never);
  await page.getByTestId('agent-build-plan').click();

  await expect(page.locator('[aria-label="agent-plan"]')).toContainText(expectedToolId);
  await expect(page.getByTestId('agent-confirmation')).not.toBeChecked();
  await expect(page.getByTestId('agent-execute')).toBeDisabled();
  await expect(page.locator('[aria-label="agent-result"]')).toHaveCount(0);

  await page.getByTestId('agent-confirmation').check();
  const executeButton = page.getByTestId('agent-execute');
  console.log('AGENT_POST_CONFIRM_STATE', JSON.stringify({
    mainLang: await main.getAttribute('lang'),
    mainDir: await main.getAttribute('dir'),
    planCount: await page.locator('[aria-label="agent-plan"]').count(),
    executeCount: await executeButton.count(),
    executeText: await executeButton.textContent().catch(() => null),
    executeDisabled: await executeButton.isDisabled().catch(() => null),
    confirmationChecked: await page.getByTestId('agent-confirmation').isChecked().catch(() => null),
  }));
  await expect(executeButton).toBeVisible({ timeout: 5_000 });
  await expect(executeButton).toBeEnabled({ timeout: 5_000 });
  await executeButton.click();
  await expect(page.locator('[aria-label="agent-result"]')).toBeVisible({ timeout: 30_000 });
}

test.describe('FLIXO ten-tool release verification', () => {
  for (const toolId of IMAGE_TOOL_IDS) {
    test('manual/' + toolId + ' executes locally and exposes an artifact', async ({ page }) => {
      await executeManualImage(page, toolId);
    });
  }

  for (const toolId of VIDEO_TOOL_IDS) {
    test('manual/' + toolId + ' executes locally and exposes an artifact', async ({ page }) => {
      await executeManualVideo(page, toolId);
    });
  }

  test('agent/background-remover-ar requires explicit confirmation and preserves RTL', async ({ page }) => {
    await planAndExecuteAgent(page, 'إزالة الخلفية', 'background-remover', 'ar', imageFixture());
  });

  test('agent/ambiguous contrast rejects guessing', async ({ page }) => {
    await page.goto('/agent', { waitUntil: 'domcontentloaded' });
    await page.locator('#agent-prompt').fill('increase contrast');
    await page.locator('#agent-file').setInputFiles(imageFixture());
    await page.getByTestId('agent-build-plan').click();
    await expect(page.locator('[aria-label="agent-plan"]')).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText(/ambiguous/i);
  });

  test('agent/compound request generates and executes a multi-step canonical plan', async ({ page }) => {
    await page.goto('/agent', { waitUntil: 'domcontentloaded' });
    await page.locator('#agent-prompt').fill('compress this image under 200KB and convert to WebP');
    await page.locator('#agent-file').setInputFiles(imageFixture());
    await page.getByTestId('agent-build-plan').click();
    const plan = page.locator('[aria-label="agent-plan"]');
    await expect(plan).toContainText('image-converter');
    await expect(plan).toContainText('image-compressor');
    await page.getByTestId('agent-confirmation').check();
    await expect(page.getByTestId('agent-execute')).toBeEnabled();
    await page.getByTestId('agent-execute').click();
    await expect(page.locator('[aria-label="agent-result"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[aria-label="agent-result"] a[download]')).toHaveAttribute('download', 'flixo-image-compressor.webp');
  });

  test('agent/compound request Arabic generates and executes the same canonical chain', async ({ page }) => {
    await page.goto('/agent', { waitUntil: 'domcontentloaded' });
    await page.locator('#agent-prompt').fill('ضغط الصورة إلى أقل من 200KB وتحويلها إلى WebP');
    await page.locator('#agent-file').setInputFiles(imageFixture());
    await page.getByTestId('agent-build-plan').click();
    const plan = page.locator('[aria-label="agent-plan"]');
    await expect(plan).toContainText('image-converter');
    await expect(plan).toContainText('image-compressor');
    await page.getByTestId('agent-confirmation').check();
    await page.getByTestId('agent-execute').click();
    await expect(page.locator('[aria-label="agent-result"]')).toBeVisible({ timeout: 30_000 });
  });

  test('agent/unsupported operation fails closed without creating a plan', async ({ page }) => {
    await page.goto('/agent', { waitUntil: 'domcontentloaded' });
    await page.locator('#agent-prompt').fill('remove the object from this image');
    await page.locator('#agent-file').setInputFiles(imageFixture());
    await page.getByTestId('agent-build-plan').click();
    await expect(page.locator('[aria-label="agent-plan"]')).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText(/No admitted FLIXO MVP capability/i);
  });


  const imageAgentCases: ReadonlyArray<readonly [string, string]> = [
    ['image-upscaler', 'upscale this image 2x'],
    ['image-cropper', 'crop this image to square'],
    ['image-compressor', 'compress my image'],
    ['image-converter', 'convert this image to webp'],
    ['image-effects', 'increase contrast by 10 percent'],
  ];

  for (const [toolId, prompt] of imageAgentCases) {
    test('agent/' + toolId + ' requires confirmation and reaches verified result', async ({ page }) => {
      await planAndExecuteAgent(page, prompt, toolId, 'en', imageFixture());
    });
  }

  const videoAgentCases: ReadonlyArray<readonly [string, string]> = [
    ['video-trimmer', 'trim the first 1 seconds of this video'],
    ['video-cropper', 'crop video to 320x180'],
    ['video-resizer', 'resize video to 320x180'],
    ['video-compressor', 'compress video'],
  ];

  for (const [toolId, prompt] of videoAgentCases) {
    test('agent/' + toolId + ' requires confirmation and reaches verified result', async ({ page }) => {
      await planAndExecuteAgent(page, prompt, toolId, 'en', await videoFixture(page));
    });
  }
});
