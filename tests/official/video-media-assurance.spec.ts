import { expect, test, type Page } from '../fixtures/universal-runtime-evidence';

test.setTimeout(180_000);

declare global {
  interface Window {
    __flixoRecorderMode?: 'failure' | 'empty';
    __flixoTrackStops?: number;
    __flixoAccelerateVideoTimeout?: boolean;
  }
}

async function installMediaHooks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as Window;
    const NativeRecorder = window.MediaRecorder;
    if (NativeRecorder) {
      class WrappedMediaRecorder extends NativeRecorder {
        start(timeslice?: number) {
          const mode = target.__flixoRecorderMode;
          if (mode === 'empty') this.ondataavailable = null;
          super.start(timeslice);
          if (mode === 'failure') {
            window.setTimeout(() => this.dispatchEvent(new Event('error')), 30);
          } else if (mode === 'empty') {
            window.setTimeout(() => {
              if (this.state !== 'inactive') {
                try { super.stop(); } catch { /* executor cleanup remains authoritative */ }
              }
            }, 150);
          }
        }
      }
      Object.defineProperty(WrappedMediaRecorder, 'isTypeSupported', {
        value: NativeRecorder.isTypeSupported?.bind(NativeRecorder),
      });
      window.MediaRecorder = WrappedMediaRecorder;
    }

    const nativeStop = MediaStreamTrack.prototype.stop;
    MediaStreamTrack.prototype.stop = function trackedStop(...args: Parameters<typeof nativeStop>) {
      target.__flixoTrackStops = (target.__flixoTrackStops ?? 0) + 1;
      return nativeStop.apply(this, args);
    };

    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: any[]) => {
      const accelerated = target.__flixoAccelerateVideoTimeout === true;
      const nextDelay = accelerated && Number(delay ?? 0) >= 500_000 ? 50 : delay;
      return nativeSetTimeout(handler, nextDelay, ...args);
    }) as typeof window.setTimeout;
  });
}

async function buildFixture(page: Page, durationMs = 2_400): Promise<Buffer> {
  return page.evaluate(async (duration) => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (!ctx || !window.MediaRecorder) throw new Error('VIDEO_FIXTURE_APIS_UNAVAILABLE');

    const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find((type) =>
      !window.MediaRecorder?.isTypeSupported || window.MediaRecorder.isTypeSupported(type),
    );
    if (!mimeType) throw new Error('VIDEO_FIXTURE_WEBM_UNAVAILABLE');

    const stream = canvas.captureStream(15);
    const recorder = new window.MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('VIDEO_FIXTURE_RECORDING_FAILED'));
      recorder.onstop = () => resolve();
    });

    recorder.start(100);
    const started = performance.now();
    const draw = () => {
      const elapsed = performance.now() - started;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, 0, 160, 180);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(160, 0, 160, 180);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(110 + Math.round(Math.sin(elapsed / 150) * 25), 60, 20, 60);
      if (elapsed >= duration) {
        recorder.stop();
        return;
      }
      requestAnimationFrame(draw);
    };
    draw();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: 'video/webm' });
    const signature = Array.from(new Uint8Array(await blob.slice(0, 4).arrayBuffer()));
    if (blob.size <= 4 || signature.join(',') !== '26,69,223,163') {
      throw new Error('VIDEO_FIXTURE_SIGNATURE_INVALID');
    }
    return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
  }, duration).then((base64) => Buffer.from(base64, 'base64'));
}

async function outputMetadata(page: Page) {
  const href = await page.getByRole('link', { name: 'Download result' }).getAttribute('href');
  if (!href) throw new Error('VIDEO_OUTPUT_URL_MISSING');
  return page.evaluate(async (sourceUrl) => {
    const blob = await (await fetch(sourceUrl)).blob();
    if (blob.type !== 'video/webm') throw new Error('VIDEO_OUTPUT_MIME_INVALID');
    if (blob.size <= 4) throw new Error('VIDEO_OUTPUT_EMPTY');
    const signature = Array.from(new Uint8Array(await blob.slice(0, 4).arrayBuffer()));
    if (signature.join(',') !== '26,69,223,163') throw new Error('VIDEO_OUTPUT_MAGIC_INVALID');

    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(blob);
    video.preload = 'auto';
    video.src = objectUrl;
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('VIDEO_OUTPUT_DECODE_FAILED'));
      });
      return { size: blob.size, width: video.videoWidth, height: video.videoHeight, duration: video.duration };
    } finally {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    }
  }, href);
}

test.describe('FLIXO Agent 2 video/media assurance', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test('all four capabilities execute locally and expose verified downloadable artifacts', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page);

    const expectations = [
      ['video-trimmer', { width: 320, height: 180 }],
      ['video-cropper', { width: 160, height: 90 }],
      ['video-resizer', { width: 1280, height: 720 }],
      ['video-compressor', { width: 320, height: 180 }],
    ] as const;

    for (const [id, expected] of expectations) {
      await page.goto('/en/' + id);
      await page.getByLabel('Choose video').setInputFiles({
        name: id + '.webm',
        mimeType: 'video/webm',
        buffer: fixture,
      });
      await page.getByRole('button', { name: 'Process video' }).click();
      await expect(page.getByRole('link', { name: 'Download result' })).toBeVisible({ timeout: 30_000 });

      const metadata = await outputMetadata(page);
      expect(metadata.width).toBe(expected.width);
      expect(metadata.height).toBe(expected.height);
      expect(metadata.duration).toBeGreaterThan(0);
      expect(metadata.size).toBeGreaterThan(4);

      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('link', { name: 'Download result' }).click();
      const download = await downloadPromise;
      expect(await download.failure()).toBeNull();
      expect(download.suggestedFilename()).toBe('flixo-video-output.webm');

      if (id === 'video-trimmer') {
        expect(metadata.duration).toBeGreaterThan(0.6);
        expect(metadata.duration).toBeLessThan(1.5);
      }
      if (id === 'video-compressor') {
        expect(metadata.size).toBeLessThan(fixture.length);
      }
    }
  });

  test('crop geometry is represented in decoded pixels', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page);
    await page.goto('/en/video-cropper');
    await page.getByLabel('Choose video').setInputFiles({ name: 'crop.webm', mimeType: 'video/webm', buffer: fixture });
    await page.getByRole('button', { name: 'Process video' }).click();
    await expect(page.getByRole('link', { name: 'Download result' })).toBeVisible({ timeout: 30_000 });

    const result = await page.evaluate(async () => {
      const href = await document.querySelector('a[download]')?.getAttribute('href');
      if (!href) throw new Error('VIDEO_CROP_OUTPUT_URL_MISSING');
      const blob = await (await fetch(href)).blob();
      const outputUrl = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'auto';
      video.src = outputUrl;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error('VIDEO_CROP_OUTPUT_DECODE_FAILED'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('VIDEO_CROP_CANVAS_UNAVAILABLE');
      ctx.drawImage(video, 0, 0);
      const pixel = ctx.getImageData(Math.floor(video.videoWidth / 2), Math.floor(video.videoHeight / 2), 1, 1).data;
      URL.revokeObjectURL(outputUrl);
      video.removeAttribute('src');
      video.load();
      return [pixel[0], pixel[1], pixel[2], pixel[3]] as [number, number, number, number];
    });
    expect(result[1]).toBeGreaterThan(result[0]);
    expect(result[1]).toBeGreaterThan(result[2]);
  });

  test('repeated execution cleans media tracks and retains a valid final artifact', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page);
    await page.evaluate(() => { window.__flixoTrackStops = 0; });
    await page.goto('/en/video-resizer');

    for (let i = 0; i < 2; i += 1) {
      await page.getByLabel('Choose video').setInputFiles({ name: 'repeat.webm', mimeType: 'video/webm', buffer: fixture });
      await page.getByRole('button', { name: 'Process video' }).click();
      await expect(page.getByRole('link', { name: 'Download result' })).toBeVisible({ timeout: 30_000 });
      if (i === 0) await page.getByLabel('Choose video').setInputFiles({ name: 'repeat-2.webm', mimeType: 'video/webm', buffer: fixture });
    }

    const stops = await page.evaluate(() => window.__flixoTrackStops ?? 0);
    expect(stops).toBeGreaterThan(0);
    const metadata = await outputMetadata(page);
    expect(metadata.width).toBe(1280);
    expect(metadata.height).toBe(720);
    expect(metadata.size).toBeGreaterThan(4);
  });

  test('recorder failure fails closed without exposing an artifact', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page);
    await page.evaluate(() => { window.__flixoRecorderMode = 'failure'; });
    await page.goto('/en/video-resizer');
    await page.getByLabel('Choose video').setInputFiles({ name: 'failure.webm', mimeType: 'video/webm', buffer: fixture });
    await page.getByRole('button', { name: 'Process video' }).click();
    await expect(page.getByRole('alert')).toContainText(/failed|recording|media/i, { timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Download result' })).toHaveCount(0);
  });

  test('empty recorder output fails closed without exposing an artifact', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page);
    await page.evaluate(() => { window.__flixoRecorderMode = 'empty'; });
    await page.goto('/en/video-resizer');
    await page.getByLabel('Choose video').setInputFiles({ name: 'empty.webm', mimeType: 'video/webm', buffer: fixture });
    await page.getByRole('button', { name: 'Process video' }).click();
    await expect(page.getByRole('alert')).toContainText(/empty|recording|failed/i, { timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Download result' })).toHaveCount(0);
  });

  test('abort cancels execution and exposes no artifact', async ({ page }) => {
    await installMediaHooks(page);
    const fixture = await buildFixture(page, 3_000);
    await page.goto('/en/video-trimmer');
    await page.getByLabel('Choose video').setInputFiles({ name: 'abort.webm', mimeType: 'video/webm', buffer: fixture });
    await page.getByRole('button', { name: 'Process video' }).click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alert')).toContainText(/cancelled|aborted|failed/i, { timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Download result' })).toHaveCount(0);
  });

  test('internal timeout fails closed', async ({ page }) => {
    await installMediaHooks(page);
    await page.addInitScript(() => { (window as Window).__flixoAccelerateVideoTimeout = true; });
    const fixture = await buildFixture(page);
    await page.goto('/en/video-resizer');
    await page.getByLabel('Choose video').setInputFiles({ name: 'timeout.webm', mimeType: 'video/webm', buffer: fixture });
    await page.getByRole('button', { name: 'Process video' }).click();
    await expect(page.getByRole('alert')).toContainText(/timeout|timed out|aborted|failed/i, { timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Download result' })).toHaveCount(0);
  });

  test('malformed WebM and MIME spoofing fail closed', async ({ page }) => {
    await page.goto('/en/video-trimmer');
    for (const [name, mimeType, bytes] of [
      ['bad.webm', 'video/webm', [0, 1, 2, 3]],
      ['spoof.mp4', 'video/mp4', [0x1a, 0x45, 0xdf, 0xa3]],
    ] as const) {
      await page.getByLabel('Choose video').setInputFiles({ name, mimeType, buffer: Buffer.from(bytes) });
      await page.getByRole('button', { name: 'Process video' }).click();
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('link', { name: 'Download result' })).toHaveCount(0);
      await page.reload();
    }
  });
});
