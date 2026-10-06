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

async function meaningfulImageFixture(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas context unavailable');

    context.fillStyle = '#f5f5f5';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#202020';
    context.fillRect(27, 27, 74, 74);
    context.fillStyle = '#d24a2e';
    context.beginPath();
    context.arc(64, 64, 27, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f0c74a';
    context.fillRect(50, 50, 28, 28);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('could not encode fixture')), 'image/png');
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  return {
    name: 'flixo-release-fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(bytes),
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
    while (performance.now() - start < 1_400) {
      const t = performance.now() - start;
      context.fillStyle = '#123';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#fff';
      context.fillRect(20 + Math.round((t / 1_400) * 200), 60, 40, 40);
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: 'video/webm' });
    const objectUrl = URL.createObjectURL(blob);
    const probe = document.createElement('video');
    probe.preload = 'auto';
    probe.src = objectUrl;
    try {
      await new Promise<void>((resolve, reject) => {
        probe.onloadedmetadata = () => resolve();
        probe.onerror = () => reject(new Error('VIDEO_FIXTURE_METADATA_INVALID'));
      });
      if (!Number.isFinite(probe.duration) || probe.duration <= 0 || probe.duration >= 600) {
        const previous = probe.currentTime;
        try {
          probe.currentTime = 1e9;
        } catch {
          void 0;
        }
        await new Promise<void>((resolve) => {
          const done = () => { probe.removeEventListener('durationchange', done); probe.removeEventListener('timeupdate', done); resolve(); };
          probe.addEventListener('durationchange', done, { once: true });
          probe.addEventListener('timeupdate', done, { once: true });
          setTimeout(done, 2_000);
        });
        try { probe.currentTime = previous; } catch { void 0; }
      }
      const ranges = probe.buffered.length > 0 ? probe.buffered : probe.seekable;
      const bounded = [probe.duration, ranges.length > 0 ? ranges.end(ranges.length - 1) : Number.NaN]
        .find((value) => Number.isFinite(value) && value > 0 && value < 600);
      if (bounded === undefined) throw new Error('VIDEO_FIXTURE_DURATION_INVALID');
    } finally {
      URL.revokeObjectURL(objectUrl);
      probe.removeAttribute('src');
      probe.load();
    }
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
  const fixture = ['background-remover', 'image-compressor', 'image-effects'].includes(toolId)
    ? await meaningfulImageFixture(page)
    : imageFixture();
  await fileInput.setInputFiles(fixture);

  if (toolId === 'image-cropper') {
    await page.getByRole('textbox', { name: 'Crop width' }).fill('4');
    await page.getByRole('textbox', { name: 'Crop height' }).fill('4');
    await page.getByRole('textbox', { name: 'Output width' }).fill('4');
    await page.getByRole('textbox', { name: 'Output height' }).fill('4');
  }

  const runButton = page.getByRole('button', { name: toolId === 'image-compressor' ? /Compress image/i : /Run tool/i });
  await expect(runButton).toBeEnabled({ timeout: 10_000 });
  await runButton.click();
  const runtimeError = await page.locator('[role="alert"]').allTextContents();
  const downloadControl = toolId === 'image-effects'
    ? page.getByRole('button', { name: /Download now/i })
    : page.locator('a[download]').first();
  await expect(downloadControl, `manual/${toolId} output missing; visible runtime errors: ${runtimeError.join(' | ')}`).toBeVisible({ timeout: 20_000 });
}

async function executeManualVideo(page: Page, toolId: (typeof VIDEO_TOOL_IDS)[number]) {
  await page.goto('/en/' + toolId, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Local video processing/i })).toBeVisible();
  const fileInput = page.getByLabel('Choose video');
  await fileInput.setInputFiles(await videoFixture(page));
  await expect(page.getByRole('button', { name: /Process video/i })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole('button', { name: /Process video/i }).click();
  const runtimeError = await page.locator('[role="alert"]').allTextContents();
  const downloadControl = page.locator('a[download]').first();
  await expect(downloadControl, `manual/${toolId} output missing; visible runtime errors: ${runtimeError.join(' | ')}`).toBeVisible({ timeout: 30_000 });
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

  test.describe('video manual release lane', () => {
    test.describe.configure({ mode: 'serial', timeout: 90_000 });

    for (const toolId of VIDEO_TOOL_IDS) {
      test('manual/' + toolId + ' executes locally and exposes an artifact', async ({ page }) => {
        await executeManualVideo(page, toolId);
      });
    }
  });

  test('manual/background-remover does not send raw fixture bytes over the network', async ({ page }) => {
    const fixture = await meaningfulImageFixture(page);
    const unexpected: Array<{ url: string; method: string; reason: string }> = [];
    const fixtureBase64 = fixture.buffer.toString('base64');
    const fixtureBuffer = fixture.buffer;

    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();
      const bodyText = request.postData();
      const bodyBytes = request.postDataBuffer();
      if (bodyText?.includes(fixtureBase64) || (bodyBytes && bodyBytes.includes(fixtureBuffer))) {
        unexpected.push({ url, method, reason: 'request body contains raw fixture bytes or base64 fixture payload' });
      }
    });

    await page.goto('/en/background-remover', { waitUntil: 'domcontentloaded' });
    const fileInput = page.locator('#image-tool-file');
    await fileInput.setInputFiles(fixture);
    await page.getByRole('button', { name: 'Run tool' }).click();
    await expect(page.locator('a[download]').first()).toBeVisible({ timeout: 20_000 });

    expect(unexpected, unexpected.map((item) => item.method + ' ' + item.url + ' — ' + item.reason).join(' | ')).toEqual([]);
  });

  test('agent/background-remover-ar requires explicit confirmation and preserves RTL', async ({ page }) => {
    await planAndExecuteAgent(page, 'إزالة الخلفية', 'background-remover', 'ar', await meaningfulImageFixture(page));
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
    await page.locator('#agent-file').setInputFiles(await meaningfulImageFixture(page));
    await page.getByTestId('agent-build-plan').click();
    const plan = page.locator('[aria-label="agent-plan"]');
    await expect(plan).toContainText('image-converter');
    await expect(plan).toContainText('image-compressor');
    await page.getByTestId('agent-confirmation').check();
    await expect(page.getByTestId('agent-execute')).toBeEnabled();
    await page.getByTestId('agent-execute').click();
    await expect(page.locator('[aria-label="agent-result"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[aria-label="agent-result"] a[download]')).toHaveAttribute('download', 'flixo-release-fixture-compressed.webp');
  });

  test('agent/compound request Arabic generates and executes the same canonical chain', async ({ page }) => {
    await page.goto('/agent', { waitUntil: 'domcontentloaded' });
    await page.locator('#agent-prompt').fill('ضغط الصورة إلى أقل من 200KB وتحويلها إلى WebP');
    await page.locator('#agent-file').setInputFiles(await meaningfulImageFixture(page));
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
      const fixture = toolId === 'image-compressor' || toolId === 'image-effects'
        ? await meaningfulImageFixture(page)
        : imageFixture();
      await planAndExecuteAgent(page, prompt, toolId, 'en', fixture);
    });
  }

  test.describe('video agent release lane', () => {
    test.describe.configure({ mode: 'serial', timeout: 90_000 });

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
});
