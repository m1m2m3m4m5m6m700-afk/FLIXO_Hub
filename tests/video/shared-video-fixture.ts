import type { Page } from '../fixtures/universal-runtime-evidence';

export const VIDEO_FIXTURE_DURATION_MS = 2_400;
export const VIDEO_FIXTURE_MIN_DURATION_MS = 2_000;

export async function buildVideoFixture(page: Page, durationMs = VIDEO_FIXTURE_DURATION_MS): Promise<Buffer> {
  if (!Number.isInteger(durationMs) || durationMs < VIDEO_FIXTURE_MIN_DURATION_MS) {
    throw new Error('VIDEO_FIXTURE_DURATION_TOO_SHORT');
  }
  const base64 = await page.evaluate(async (duration) => {
    if (typeof MediaRecorder === 'undefined') throw new Error('VIDEO_FIXTURE_MEDIARECORDER_UNAVAILABLE');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('VIDEO_FIXTURE_CANVAS_UNAVAILABLE');

    const candidates = ['video/webm;codecs=vp8', 'video/webm'];
    const mimeType = candidates.find((candidate) =>
      typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(candidate),
    );
    if (!mimeType) throw new Error('VIDEO_FIXTURE_WEBM_UNAVAILABLE');

    const stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    const finished = new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('VIDEO_FIXTURE_RECORDING_FAILED'));
      recorder.onstop = () => resolve();
    });

    recorder.start(100);
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const draw = () => {
        const elapsed = performance.now() - started;
        context.fillStyle = '#111827';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#22c55e';
        context.fillRect(30, 30, 90, 120);
        context.fillStyle = '#3b82f6';
        context.fillRect(120, 30, 90, 120);
        context.fillStyle = '#ffffff';
        context.font = '24px sans-serif';
        context.fillText('FLIXO VIDEO FIXTURE', 25, 165);
        if (elapsed >= duration) {
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
    if (bytes.length <= 4 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
      throw new Error('VIDEO_FIXTURE_SIGNATURE_INVALID');
    }
    let binary = '';
    const batch = 0x8000;
    for (let index = 0; index < bytes.length; index += batch) {
      binary += String.fromCharCode(...bytes.subarray(index, index + batch));
    }
    return btoa(binary);
  }, durationMs);

  return Buffer.from(base64, 'base64');
}
