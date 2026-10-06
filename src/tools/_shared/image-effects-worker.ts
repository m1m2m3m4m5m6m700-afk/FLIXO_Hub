type ImageEffectsWorkerMessage = {
  blob: Blob;
  width: number;
  height: number;
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
};

type ImageEffectsWorkerScope = {
  onmessage: ((event: MessageEvent<ImageEffectsWorkerMessage>) => void | Promise<void>) | null;
  postMessage(message: unknown): void;
};

const imageEffectsWorkerScope = self as unknown as ImageEffectsWorkerScope;

imageEffectsWorkerScope.onmessage = async (event: MessageEvent<ImageEffectsWorkerMessage>) => {
  let image: ImageBitmap | undefined;
  try {
    if (typeof OffscreenCanvas === 'undefined') throw new Error('Image Effects Worker is unavailable.');
    const { width, height, brightness, contrast, saturate, grayscale } = event.data;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 16_000_000) {
      throw new Error('Image Effects output dimensions exceed the browser safety limit.');
    }
    if (![brightness, contrast, saturate, grayscale].every(Number.isFinite) || brightness < 0 || brightness > 200 || contrast < 0 || contrast > 200 || saturate < 0 || saturate > 200 || grayscale < 0 || grayscale > 100) {
      throw new Error('Image Effects parameters are invalid.');
    }
    image = await createImageBitmap(event.data.blob);
    if (image.width !== width || image.height !== height) throw new Error('Image Effects source dimensions do not match the request.');
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.filter = `brightness(${event.data.brightness}%) contrast(${event.data.contrast}%) saturate(${event.data.saturate}%) grayscale(${event.data.grayscale}%)`;
    context.drawImage(image, 0, 0, event.data.width, event.data.height);
    image.close();
    const output = await canvas.convertToBlob({ type: 'image/png', quality: 0.96 });
    if (!output || output.size <= 0 || output.size > 64 * 1024 * 1024 || output.type !== 'image/png') throw new Error('Image Effects output is invalid.');
    imageEffectsWorkerScope.postMessage({ ok: true, blob: output });
  } catch (error) {
    imageEffectsWorkerScope.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Image Effects Worker failed.' });
  } finally {
    image?.close();
  }
};
