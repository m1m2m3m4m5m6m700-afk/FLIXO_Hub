export type OcrWorkerResult = { text: string };

type TesseractWorker = {
  recognize(input: Blob, options?: Record<string, unknown>): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
};

type TesseractApi = {
  createWorker(language: string, oem: number, options: {
    corePath: string;
    langPath: string;
    workerPath: string;
    workerBlobURL: boolean;
    gzip: boolean;
  }): Promise<TesseractWorker>;
};

type WorkerResponse = { ok: boolean; blob?: Blob; error?: string };

declare global {
  interface Window {
    Tesseract?: TesseractApi;
  }
}

const TESSERACT_VERSION = '7.0.0';
const TESSERACT_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`;
const TESSERACT_WORKER_URL = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`;
const TESSERACT_CORE_URL = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_VERSION}`;
const TESSERACT_LANG_URL = 'https://tessdata.projectnaptha.com/4.0.0';

async function ensureTesseract(): Promise<TesseractApi> {
  if (window.Tesseract) return window.Tesseract;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TESSERACT_SCRIPT_URL;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.dataset.flixoPinnedDependency = `tesseract.js@${TESSERACT_VERSION}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('OCR engine could not be loaded.'));
    document.head.appendChild(script);
  });
  if (!window.Tesseract) throw new Error('OCR engine is unavailable.');
  return window.Tesseract;
}

async function preprocessWithWorker(blob: Blob): Promise<Blob> {
  if (typeof Worker === 'undefined') throw new Error('Web Worker is unavailable.');

  return await new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL('./ocr-worker.ts', import.meta.url), { type: 'classic' });
    const cleanup = () => worker.terminate();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      cleanup();
      if (event.data.ok && event.data.blob instanceof Blob) {
        resolve(event.data.blob);
      } else {
        reject(new Error(event.data.error || 'OCR preprocessing failed.'));
      }
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error('OCR preprocessing worker could not start.'));
    };

    worker.postMessage({ blob });
  });
}

export async function recognizeWithOcrWorker(blob: Blob, language: string): Promise<OcrWorkerResult> {
  const prepared = await preprocessWithWorker(blob);
  const tesseract = await ensureTesseract();
  const worker = await tesseract.createWorker(language, 1, {
    corePath: TESSERACT_CORE_URL,
    langPath: TESSERACT_LANG_URL,
    workerPath: TESSERACT_WORKER_URL,
    workerBlobURL: false,
    gzip: true,
  });

  try {
    const result = await worker.recognize(prepared);
    return { text: result.data.text };
  } finally {
    await worker.terminate();
  }
}
