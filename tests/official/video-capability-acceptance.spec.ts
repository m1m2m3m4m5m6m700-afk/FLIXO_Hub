import { expect, test } from '../fixtures/universal-runtime-evidence';

async function buildVideoFixture(page: Parameters<Parameters<typeof test>[2]>[0]['page']): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    if (typeof MediaRecorder === 'undefined') throw new Error('VIDEO_FIXTURE_MEDIARECORDER_UNAVAILABLE');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('VIDEO_FIXTURE_CANVAS_UNAVAILABLE');

    const candidates = [
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    const mimeType = candidates.find((candidate) =>
      typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(candidate),
    );
    if (!mimeType) throw new Error('VIDEO_FIXTURE_WEBM_UNAVAILABLE');

    const stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    const finished = new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('VIDEO_FIXTURE_RECORDING_FAILED'));
      recorder.onstop = () => resolve();
    });

    recorder.start();
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const draw = () => {
        const elapsed = performance.now() - started;
        context.fillStyle = '#111827';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = elapsed < 400 ? '#22c55e' : '#3b82f6';
        context.fillRect(30, 30, 120 + Math.min(120, elapsed / 5), 120);
        context.fillStyle = '#ffffff';
        context.font = '24px sans-serif';
        context.fillText('FLIXO VIDEO FIXTURE', 25, 165);
        if (elapsed >= 800) {
          recorder.stop();
          resolve();
          return;
        }
        requestAnimationFrame(draw);
      };
      draw();
    });

    await finished;
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: 'video/webm' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const batch = 0x8000;
    for (let index = 0; index < bytes.length; index += batch) {
      binary += String.fromCharCode(...bytes.subarray(index, index + batch));
    }
    return btoa(binary);
  });

  return Buffer.from(base64, 'base64');
}

const VIDEO_CASES = [
  { id: 'video-trimmer', title: 'Video Trimmer' },
  { id: 'video-cropper', title: 'Video Cropper' },
  { id: 'video-resizer', title: 'Video Resizer' },
  { id: 'video-compressor', title: 'Video Compressor' },
] as const;

test.describe('MVP video capability individual acceptance', () => {
  for (const videoCase of VIDEO_CASES) {
    test(videoCase.id + ' executes locally with measurable output behavior', async ({ page }) => {
      await page.goto('/en/' + videoCase.id);
      await expect(page.getByRole('heading', { name: 'Local video processing' })).toBeVisible();

      const fixture = await buildVideoFixture(page);
      expect(fixture.length).toBeGreaterThan(100);

      await page.getByLabel('Choose video').setInputFiles({
        name: videoCase.id + '-fixture.webm',
        mimeType: 'video/webm',
        buffer: fixture,
      });

      if (videoCase.id === 'video-trimmer') {
        await page.getByLabel('Start time (seconds)').fill('0.20');
        await page.getByLabel('End time (seconds)').fill('0.60');
      } else if (videoCase.id === 'video-cropper') {
        await page.getByLabel('Width').fill('160');
        await page.getByLabel('Height').fill('90');
      } else if (videoCase.id === 'video-resizer') {
        await page.getByLabel('Width').fill('160');
        await page.getByLabel('Height').fill('90');
        await page.getByLabel('FPS').fill('15');
      } else {
        await page.getByLabel('Video bitrate (bps)').fill('256000');
        await page.getByLabel('Audio bitrate (bps)').fill('64000');
      }

      await page.getByRole('button', { name: 'Process video' }).click();

      const downloadLink = page.getByRole('link', { name: 'Download result' });
      await expect(downloadLink).toBeVisible({ timeout: 30_000 });

      const outputUrl = await downloadLink.getAttribute('href');
      expect(outputUrl).toMatch(/^blob:/u);

      const metadata = await page.evaluate(async (url) => {
        if (!url) throw new Error('VIDEO_OUTPUT_URL_MISSING');
        const response = await fetch(url);
        const blob = await response.blob();
        if (blob.size <= 4 || blob.type !== 'video/webm') {
          throw new Error('VIDEO_OUTPUT_CONTRACT_INVALID');
        }
        const video = document.createElement('video');
        video.preload = 'metadata';
        const objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
        try {
          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => reject(new Error('VIDEO_OUTPUT_METADATA_INVALID'));
          });
          return { size: blob.size, type: blob.type, duration: video.duration, width: video.videoWidth, height: video.videoHeight };
        } finally {
          URL.revokeObjectURL(objectUrl);
          video.removeAttribute('src');
          video.load();
        }
      }, outputUrl);

      expect(metadata.size).toBeGreaterThan(4);
      expect(metadata.type).toBe('video/webm');
      expect(metadata.duration).toBeGreaterThan(0);
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
      if (videoCase.id === 'video-trimmer') {
        expect(Math.abs(metadata.duration - 0.4)).toBeLessThan(0.4);
      }
      if (videoCase.id === 'video-cropper' || videoCase.id === 'video-resizer') {
        expect(metadata.width).toBe(160);
        expect(metadata.height).toBe(90);
      }

      const downloadPromise = page.waitForEvent('download');
      await downloadLink.click();
      const download = await downloadPromise;
      expect(await download.failure()).toBeNull();
      expect(download.suggestedFilename()).toBe('flixo-video-output.webm');
    });
  }
});


test('video tools reject malformed containers before processing', async ({ page }) => {
  await page.goto('/en/video-trimmer');
  await expect(page.getByRole('heading', { name: 'Local video processing' })).toBeVisible();
  await page.getByLabel('Choose video').setInputFiles({
    name: 'malformed.webm',
    mimeType: 'video/webm',
    buffer: Buffer.from('NOT-A-WEBM'),
  });
  await expect(page.getByRole('alert')).toContainText('selected video is not supported');
  await expect(page.getByRole('button', { name: 'Process video' })).toBeDisabled();
});

test('video cropper rejects rectangles outside decoded dimensions', async ({ page }) => {
  await page.goto('/en/video-cropper');
  const fixture = await buildVideoFixture(page);
  await page.getByLabel('Choose video').setInputFiles({
    name: 'crop-boundary.webm',
    mimeType: 'video/webm',
    buffer: fixture,
  });
  await expect(page.getByText('320 × 180px')).toBeVisible();
  await page.getByLabel('Width').fill('321');
  await page.getByLabel('Height').fill('180');
  await page.getByRole('button', { name: 'Process video' }).click();
  await expect(page.getByRole('alert')).toContainText('VIDEO_CROP_BOUNDS_INVALID');
});
