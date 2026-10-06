import { expect, test, type Page } from '../fixtures/universal-runtime-evidence';

test.setTimeout(180_000);

type VideoId = 'video-trimmer' | 'video-cropper' | 'video-resizer' | 'video-compressor';

const CASES: ReadonlyArray<{
  id: VideoId;
  fields: ReadonlyArray<[string, string]>;
}> = [
  { id: 'video-trimmer', fields: [['Start (seconds)', '0'], ['End (seconds)', '0.5']] },
  { id: 'video-cropper', fields: [['Crop X', '64'], ['Crop Y', '48'], ['Width', '64'], ['Height', '64']] },
  { id: 'video-resizer', fields: [['Width', '160'], ['Height', '90'], ['FPS', '15']] },
  { id: 'video-compressor', fields: [['Video bitrate', '200000'], ['Audio bitrate', '64000']] },
];

async function installMediaHooks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const nativeRecorder = window.MediaRecorder;
    const nativeSetTimeout = window.setTimeout.bind(window);
    if (nativeRecorder) {
      class WrappedMediaRecorder extends nativeRecorder {
        start(timeslice?: number) {
          const mode = (window as Window & { __flixoRecorderMode?: string }).__flixoRecorderMode;
          if (mode === 'failure') {
            super.start(timeslice);
            nativeSetTimeout(() => this.dispatchEvent(new Event('error')), 50);
            return;
          }
          if (mode === 'empty') {
            super.start(timeslice);
            this.ondataavailable = null;
            return;
          }
          return super.start(timeslice);
        }
      }
      Object.defineProperty(WrappedMediaRecorder, 'isTypeSupported', {
        value: nativeRecorder.isTypeSupported?.bind(nativeRecorder),
      });
      window.MediaRecorder = WrappedMediaRecorder;
    }

    const originalStop = window.MediaStreamTrack?.prototype.stop;
    if (originalStop) {
      window.MediaStreamTrack.prototype.stop = function stopWithEvidence(...args) {
        const target = window as Window & { __flixoTrackStops?: number };
        target.__flixoTrackStops = (target.__flixoTrackStops ?? 0) + 1;
        return originalStop.apply(this, args);
      };
    }

    const originalSetTimeout = window.setTimeout;
    window.setTimeout = function guardedSetTimeout(handler, delay, ...args) {
      const accelerated = Boolean((window as Window & { __flixoAccelerateVideoTimeout?: boolean }).__flixoAccelerateVideoTimeout);
      const nextDelay = accelerated && Number(delay) >= 500_000 ? 50 : delay;
      return nativeSetTimeout(handler, nextDelay, ...args);
    } as typeof window.setTimeout;
  });
}

async function buildFixture(page: Page, seconds = 1.4): Promise<Buffer> {
  return page.evaluate(async (durationSeconds) => {
    if (!window.MediaRecorder) throw new Error('VIDEO_FIXTURE_MEDIARECORDER_UNAVAILABLE');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('VIDEO_FIXTURE_CANVAS_UNAVAILABLE');

    const candidates = ['video/webm;codecs=vp8', 'video/webm'];
    const mimeType = candidates.find((candidate) =>
      !window.MediaRecorder?.isTypeSupported || window.MediaRecorder.isTypeSupported(candidate),
    );
    if (!mimeType) throw new Error('VIDEO_FIXTURE_WEBM_UNAVAILABLE');

    const stream = canvas.captureStream(15);
    const recorder = new window.MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    await new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('VIDEO_FIXTURE_RECORDING_FAILED'));
      recorder.onstop = () => resolve();
      recorder.start(100);

      const started = performance.now();
      const draw = () => {
        const elapsed = performance.now() - started;
        context.fillStyle = '#101820';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#16a34a';
        context.fillRect(40, 30, 100, 90);
        context.fillStyle = '#dc2626';
        context.fillRect(180, 30, 100, 90);
        context.fillStyle = '#2563eb';
        context.fillRect(40, 120, 100, 40);
        context.fillStyle = '#facc15';
        context.fillRect(180, 120, 100, 40);
        context.fillStyle = '#ffffff';
        context.fillRect(140 + Math.round(Math.sin(elapsed / 120) * 30), 70, 16, 16);
        if (elapsed >= durationSeconds * 1000) {
          recorder.stop();
          return;
        }
        requestAnimationFrame(draw);
      };
      draw();
    });

    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: 'video/webm' });
    const probe = document.createElement('video');
    const url = URL.createObjectURL(blob);
    probe.preload = 'metadata';
    probe.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        probe.onloadedmetadata = () => resolve();
        probe.onerror = () => reject(new Error('VIDEO_FIXTURE_METADATA_INVALID'));
      });
      if (!Number.isFinite(probe.duration) || probe.duration <= 0) throw new Error('VIDEO_FIXTURE_DURATION_INVALID');
    } finally {
      URL.revokeObjectURL(url);
      probe.removeAttribute('src');
      probe.load();
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  }, seconds).then((base64) => Buffer.from(base64, 'base64'));
}

async function readOutput(page: Page): Promise<{
  size: number;
  type: string;
  width: number;
  height: number;
  duration: number;
  firstPixel?: [number, number, number, number];
}> {
  const href = await page.getByRole('link', { name: 'Download result' }).getAttribute('href');
  if (!href || !href.startsWith('blob:')) throw new Error('VIDEO_OUTPUT_BLOB_URL_MISSING');

  return page.evaluate(async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (blob.type !== 'video/webm') throw new Error('VIDEO_OUTPUT_MIME_INVALID');
    if (blob.size <= 4) throw new Error('VIDEO_OUTPUT_EMPTY');
    if (bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) throw new Error('VIDEO_OUTPUT_MAGIC_INVALID');

    const video = document.createElement('video');
    const url = URL.createObjectURL(blob);
    video.preload = 'metadata';
    video.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('VIDEO_OUTPUT_DECODE_FAILED'));
      });
      return {
        size: blob.size,
        type: blob.type,
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      };
    } finally {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    }
  }, href);
}

async function processCase(page: Page, videoCase: typeof CASES[number], fixture: Buffer): Promise<{inputSize: number; output: Awaited<ReturnType<typeof readOutput>>}> {
  await page.goto('/en/' + videoCase.id, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Local video processing/i })).toBeVisible();

  await page.getByLabel('Choose video').setInputFiles({
    name: videoCase.id + '-fixture.webm',
    mimeType: 'video/webm',
    buffer: fixture,
  });
  for (const [label, value] of videoCase.fields) {
    await page.getByLabel(label).fill(value);
  }

  const nonGet: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) nonGet.push(request.method() + ' ' + request.url());
  });

  await page.getByRole('button', { name: 'Process video' }).click();
  const downloadLink = page.getByRole('link', { name: 'Download result' });
  await expect(downloadLink).toBeVisible({ timeout: 60_000 });

  const output = await readOutput(page);
  expect(nonGet).toEqual([]);
  const downloadPromise = page.waitForEvent('download');
  await downloadLink.click();
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe('flixo-video-output.webm');
  return { inputSize: fixture.length, output };
}

test.describe('FLIXO video/media execution assurance', () => {
  test('all four video capabilities execute in real Chromium and export verified local artifacts', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page);

    const trim = await processCase(page, CASES[0], fixture);
    expect(trim.output.width).toBe(320);
    expect(trim.output.height).toBe(180);
    expect(trim.output.duration).toBeGreaterThan(0.30);
    expect(trim.output.duration).toBeLessThan(0.85);

    const crop = await processCase(page, CASES[1], fixture);
    expect(crop.output.width).toBe(64);
    expect(crop.output.height).toBe(64);

    const resize = await processCase(page, CASES[2], fixture);
    expect(resize.output.width).toBe(160);
    expect(resize.output.height).toBe(90);

    const compressor = await processCase(page, CASES[3], fixture);
    expect(compressor.output.width).toBe(320);
    expect(compressor.output.height).toBe(180);
    expect(compressor.output.size).toBeLessThan(compressor.inputSize);
  });

  test('crop geometry is reflected in decoded output pixels', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page);
    await page.goto('/en/video-cropper');
    await page.getByLabel('Choose video').setInputFiles({ name: 'crop.webm', mimeType: 'video/webm', buffer: fixture });
    await page.getByLabel('Crop X').fill('40');
    await page.getByLabel('Crop Y').fill('30');
    await page.getByLabel('Width').fill('100');
    await page.getByLabel('Height').fill('90');
    await page.getByRole('button', { name: 'Process video' }).click();
    await expect(page.getByRole('link', { name: 'Download result' })).toBeVisible({ timeout: 60_000 });

    const pixel = await page.evaluate(async () => {
      const href = await document.querySelector('a[download]')?.getAttribute('href');
      if (!href) throw new Error('VIDEO_CROP_OUTPUT_URL_MISSING');
      const blob = await (await fetch(href)).blob();
      const url = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'auto';
      video.src = url;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error('VIDEO_CROP_OUTPUT_DECODE_FAILED'));
      });
      video.currentTime = 0;
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) return resolve();
        video.onloadeddata = () => resolve();
      });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('VIDEO_CROP_CANVAS_UNAVAILABLE');
      context.drawImage(video, 0, 0);
      const sample = context.getImageData(Math.floor(video.videoWidth / 2), Math.floor(video.videoHeight / 2), 1, 1).data;
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      return [sample[0], sample[1], sample[2], sample[3]] as [number, number, number, number];
    });
    expect(pixel[1]).toBeGreaterThan(pixel[0]);
    expect(pixel[1]).toBeGreaterThan(pixel[2]);
  });

  test('repeated execution stops media tracks and leaves one final artifact', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page);
    await page.evaluate(() => {
      (window as Window & { __flixoTrackStops?: number }).__flixoTrackStops = 0;
    });
    await page.goto('/en/video-resizer');
    for (let run = 0; run < 2; run += 1) {
      await page.getByLabel('Choose video').setInputFiles({ name: 'repeat.webm', mimeType: 'video/webm', buffer: fixture });
      await page.getByRole('button', { name: 'Process video' }).click();
      await expect(page.getByRole('link', { name: 'Download result' })).toBeVisible({ timeout: 60_000 });
      if (run === 0) await page.getByRole('button', { name: 'Reset' }).click();
    }
    const stops = await page.evaluate(() => (window as Window & { __flixoTrackStops?: number }).__flixoTrackStops ?? 0);
    expect(stops).toBeGreaterThan(0);
  });

  test('MIME spoofing and malformed WebM fail closed without an artifact', async ({ page }) => {
    await installMediaHooks(page);
    await page.goto('/en/video-trimmer');
    await page.getByLabel('Choose video').setInputFiles({
      name: 'spoof.webm',
      mimeType: 'video/webm',
      buffer: Buffer.from('not a webm file', 'utf8'),
    });
    await page.getByLabel('End (seconds)').fill('0.5');
    await page.getByRole('button', { name: 'Process video' }).click();
    await expect(page.getByRole('alert')).toContainText(/signature|denied|failed/i);
    await expect(page.locator('a[download]')).toHaveCount(0);
  });

  test('recorder failure fails closed without a downloadable artifact', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page);
    await page.evaluate(() => {
      (window as Window & { __flixoRecorderMode?: string }).__flixoRecorderMode = 'failure';
    });
    await page.goto('/en/video-resizer');
    await page.getByLabel('Choose video').setInputFiles({ name: 'recorder-failure.webm', mimeType: 'video/webm', buffer: fixture });
    await page.getByRole('button', { name: 'Process video' }).click();
    await expect(page.getByRole('alert')).toContainText(/failed|recording|media/i, { timeout: 30_000 });
    await expect(page.locator('a[download]')).toHaveCount(0);
  });

  test('empty recorder output fails closed without a downloadable artifact', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page);
    await page.evaluate(() => {
      (window as Window & { __flixoRecorderMode?: string }).__flixoRecorderMode = 'empty';
    });
    await page.goto('/en/video-resizer');
    await page.getByLabel('Choose video').setInputFiles({ name: 'recorder-empty.webm', mimeType: 'video/webm', buffer: fixture });
    await page.getByRole('button', { name: 'Process video' }).click();
    await expect(page.getByRole('alert')).toContainText(/empty|failed|recording/i, { timeout: 30_000 });
    await expect(page.locator('a[download]')).toHaveCount(0);
  });

  test('abort cancels execution and no artifact is exposed', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page, 3);
    await page.goto('/en/video-trimmer');
    await page.getByLabel('Choose video').setInputFiles({ name: 'abort.webm', mimeType: 'video/webm', buffer: fixture });
    await page.getByLabel('End (seconds)').fill('2.5');
    await page.getByRole('button', { name: 'Process video' }).click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alert')).toContainText(/aborted|cancelled|failed/i, { timeout: 30_000 });
    await expect(page.locator('a[download]')).toHaveCount(0);
  });

  test('video timeout aborts internally and fails closed', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page);
    await page.evaluate(() => {
      (window as Window & { __flixoAccelerateVideoTimeout?: boolean }).__flixoAccelerateVideoTimeout = true;
    });
    await page.goto('/en/video-resizer');
    await page.getByLabel('Choose video').setInputFiles({ name: 'timeout.webm', mimeType: 'video/webm', buffer: fixture });
    await page.getByRole('button', { name: 'Process video' }).click();
    await expect(page.getByRole('alert')).toContainText(/timed out|timeout|failed|aborted/i, { timeout: 30_000 });
    await expect(page.locator('a[download]')).toHaveCount(0);
  });
});
