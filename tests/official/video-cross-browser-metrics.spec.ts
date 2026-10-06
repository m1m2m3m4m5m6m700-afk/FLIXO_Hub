import { expect, test, type Page } from '../fixtures/universal-runtime-evidence';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
test.setTimeout(240_000);

async function buildRealFixture(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!ctx || !window.MediaRecorder || !AudioContextCtor) throw new Error('VIDEO_METRICS_APIS_UNAVAILABLE');
    const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm'].find((x) => !window.MediaRecorder.isTypeSupported || window.MediaRecorder.isTypeSupported(x));
    if (!mimeType) throw new Error('VIDEO_METRICS_WEBM_UNAVAILABLE');
    const videoStream = canvas.captureStream(15);
    const audioContext = new AudioContextCtor();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const destination = audioContext.createMediaStreamDestination();
    oscillator.frequency.value = 440; gain.gain.value = 0.02;
    oscillator.connect(gain); gain.connect(destination);
    await audioContext.resume(); oscillator.start();
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('VIDEO_METRICS_RECORDING_FAILED'));
      recorder.onstop = () => resolve();
    });
    recorder.start(100);
    const started = performance.now();
    const draw = () => {
      const elapsed = performance.now() - started;
      ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(0, 0, 160, 180);
      ctx.fillStyle = '#2563eb'; ctx.fillRect(160, 0, 160, 180);
      ctx.fillStyle = '#fff'; ctx.fillRect(110 + Math.round(Math.sin(elapsed / 150) * 25), 60, 20, 60);
      if (elapsed >= 2400) { recorder.stop(); oscillator.stop(); videoStream.getTracks().forEach((track) => track.stop()); return; }
      requestAnimationFrame(draw);
    };
    draw(); await stopped; stream.getTracks().forEach((track) => track.stop()); await audioContext.close();
    const blob = new Blob(chunks, { type: 'video/webm' });
    return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
  });
  return Buffer.from(base64, 'base64');
}

async function outputBytes(page: Page): Promise<Buffer> {
  const href = await page.getByRole('link', { name: 'Download result' }).getAttribute('href');
  if (!href) throw new Error('VIDEO_METRICS_OUTPUT_URL_MISSING');
  const base64 = await page.evaluate(async (url) => {
    const blob = await (await fetch(url)).blob();
    if (blob.type !== 'video/webm' || blob.size <= 4) throw new Error('VIDEO_METRICS_OUTPUT_CONTRACT_INVALID');
    return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
  }, href);
  return Buffer.from(base64, 'base64');
}

async function probe(path: string): Promise<any[]> {
  const result = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height', '-of', 'json', path]);
  return JSON.parse(result.stdout).streams || [];
}

test.describe('video cross-browser measured evidence', () => {
  test.describe.configure({ mode: 'serial' });
  test('four tools produce real-file measurements', async ({ page }, testInfo) => {
    const browser = testInfo.project.name;
    await page.goto('/en/video-trimmer');
    const input = await buildRealFixture(page);
    const inputPath = testInfo.outputPath('input-' + browser + '.webm');
    await writeFile(inputPath, input);
    const inputStreams = await probe(inputPath);
    const inputAudio = inputStreams.filter((s) => s.codec_type === 'audio').length;

    const cases = [
      { id: 'video-trimmer', width: 320, height: 180 },
      { id: 'video-cropper', width: 160, height: 90 },
      { id: 'video-resizer', width: 1280, height: 720 },
      { id: 'video-compressor', width: 320, height: 180 },
    ];

    for (const item of cases) {
      await page.goto('/en/' + item.id);
      await page.getByLabel('Choose video').setInputFiles({ name: item.id + '.webm', mimeType: 'video/webm', buffer: input });
      const start = performance.now();
      await page.getByRole('button', { name: 'Process video' }).click();
      await expect(page.getByRole('link', { name: 'Download result' })).toBeVisible({ timeout: 45_000 });
      const executionMs = Math.round(performance.now() - start);
      const output = await outputBytes(page);
      const outputPath = testInfo.outputPath('output-' + browser + '-' + item.id + '.webm');
      await writeFile(outputPath, output);
      const streams = await probe(outputPath);
      const audio = streams.filter((s) => s.codec_type === 'audio').length;
      const video = streams.find((s) => s.codec_type === 'video');
      const duration = await page.evaluate(async () => {
        const href = await document.querySelector('a[download]')?.getAttribute('href');
        if (!href) throw new Error('VIDEO_METRICS_DURATION_URL_MISSING');
        const blob = await (await fetch(href)).blob();
        const url = URL.createObjectURL(blob); const el = document.createElement('video'); el.preload = 'auto'; el.src = url;
        await new Promise<void>((resolve, reject) => { el.onloadedmetadata = () => resolve(); el.onerror = () => reject(new Error('VIDEO_METRICS_DURATION_DECODE_FAILED')); });
        const value = el.duration; URL.revokeObjectURL(url); el.removeAttribute('src'); el.load(); return value;
      });
      const reduction = item.id === 'video-compressor' ? Number((((input.length - output.length) / input.length) * 100).toFixed(2)) : null;
      const metric = { browser, tool: item.id, executionMs, inputBytes: input.length, outputBytes: output.length, inputAudioTracks: inputAudio, outputAudioTracks: audio, durationSeconds: Number(duration.toFixed(3)), width: Number(video?.width || 0), height: Number(video?.height || 0), sizeReductionPct: reduction };
      console.log('VIDEO_METRIC ' + JSON.stringify(metric));
      expect(output.length).toBeGreaterThan(4);
      expect(Number(video?.width || 0)).toBe(item.width);
      expect(Number(video?.height || 0)).toBe(item.height);
      expect(duration).toBeGreaterThan(0);
      if (item.id === 'video-trimmer') expect(duration).toBeGreaterThan(0.6);
      if (item.id === 'video-trimmer') expect(duration).toBeLessThan(1.5);
      if (item.id === 'video-compressor') expect(output.length).toBeLessThan(input.length);
    }
    expect(inputAudio).toBeGreaterThanOrEqual(1);
  });
});