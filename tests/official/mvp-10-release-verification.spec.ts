
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
        if (elapsed >= 2400) {
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

  const buffer = Buffer.from(base64, 'base64');
  return {
    name: 'flixo-release-fixture.webm',
    mimeType: 'video/webm',
    buffer,
  };
}
