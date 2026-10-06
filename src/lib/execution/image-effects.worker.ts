type EffectName = 'brightness' | 'contrast' | 'saturation' | 'grayscale';

type Effect = readonly [EffectName, number];

type WorkerRequest = {
  blob: Blob;
  effects: readonly Effect[];
};

type WorkerSuccess = { ok: true; blob: Blob };
type WorkerFailure = { ok: false; error: string };

const filterFor = (effect: Effect): string => {
  const [name, value] = effect;
  switch (name) {
    case 'brightness': return `brightness(${value}%)`;
    case 'contrast': return `contrast(${value}%)`;
    case 'saturation': return `saturate(${value}%)`;
    case 'grayscale': return `grayscale(${Math.max(0, Math.min(100, value))}%)`;
  }
};

const drawPass = async (
  source: ImageBitmap | OffscreenCanvas,
  width: number,
  height: number,
  effect: Effect,
): Promise<OffscreenCanvas> => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('IMAGE_EFFECTS_WORKER_CANVAS_UNAVAILABLE');
  context.filter = filterFor(effect);
  context.drawImage(source, 0, 0, width, height);
  return canvas;
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const { blob, effects } = event.data;
    if (!(blob instanceof Blob) || !effects.length) throw new Error('IMAGE_EFFECTS_WORKER_INPUT_INVALID');

    const bitmap = await createImageBitmap(blob);
    try {
      let source: ImageBitmap | OffscreenCanvas = bitmap;
      let output: OffscreenCanvas | null = null;
      for (const effect of effects) {
        output = await drawPass(source, bitmap.width, bitmap.height, effect);
        source = output;
      }
      if (!output) throw new Error('IMAGE_EFFECTS_WORKER_OUTPUT_MISSING');
      const blobOut = await output.convertToBlob({ type: 'image/png' });
      self.postMessage({ ok: true, blob: blobOut } satisfies WorkerSuccess);
    } finally {
      bitmap.close();
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : 'IMAGE_EFFECTS_WORKER_FAILED';
    self.postMessage({ ok: false, error: code } satisfies WorkerFailure);
  }
};
