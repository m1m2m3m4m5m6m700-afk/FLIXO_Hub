export type OcrWorkerResult = { text: string };

type TesseractWorker = {
  recognize(input: Blob): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
};

type TesseractApi = {
  createWorker(
    langs: string,
    oem?: number,
    options?: {
      workerPath: string;
      corePath: string;
      langPath: string;
      workerBlobURL: boolean;
      cacheMethod: string;
      gzip: boolean;
      legacyLang: boolean;
      legacyCore: boolean;
    },
  ): Promise<TesseractWorker>;
};

declare global {
  interface Window {
    Tesseract?: TesseractApi;
  }
}

export const TESSERACT_VERSION = '6.0.1';
export const TESSERACT_CORE_VERSION = '6.0.0';
export const TESSERACT_LANG_DATA_VERSION = '4.0.0_best_int';
export const TESSERACT_MAIN_PATH = '/vendor/tesseract/6.0.1/tesseract.min.js';
export const TESSERACT_WORKER_PATH = '/vendor/tesseract/6.0.1/worker.min.js';
export const TESSERACT_CORE_PATH = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0';
export const TESSERACT_LANG_PATHS: Readonly<Record<string, string>> = Object.freeze({
  eng: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
  ara: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/ara@1.0.0/4.0.0_best_int',
});

async function ensureTesseract(): Promise<TesseractApi> {
  if (window.Tesseract?.createWorker) return window.Tesseract;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TESSERACT_MAIN_PATH;
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('OCR engine could not be loaded.'));
    document.head.appendChild(script);
  });
  if (!window.Tesseract?.createWorker) throw new Error('OCR engine is unavailable.');
  return window.Tesseract;
}

async function preprocessWithWorker(blob: Blob): Promise<Blob> {
  if (typeof Worker === 'undefined') throw new Error('Web Worker is unavailable.');
  return await new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL('./ocr-worker.ts', import.meta.url), { type: 'classic' });
    const cleanup = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<{ ok: boolean; blob?: Blob; error?: string }>) => {
      cleanup();
      if (event.data.ok && event.data.blob instanceof Blob) resolve(event.data.blob);
      else reject(new Error(event.data.error || 'OCR preprocessing failed.'));
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('OCR preprocessing worker could not start.'));
    };
    worker.postMessage({ blob });
  });
}

const languages = (requested: string) =>
  [...new Set(
    requested.split('+').map((value) => value.trim().toLowerCase())
      .filter((value) => value in TESSERACT_LANG_PATHS),
  )];

const recognizeForLanguage = async (tesseract: TesseractApi, prepared: Blob, language: string): Promise<string> => {
  const langPath = TESSERACT_LANG_PATHS[language];
  if (!langPath) throw new Error('Unsupported OCR language.');
  const worker = await tesseract.createWorker(language, 1, {
    workerPath: TESSERACT_WORKER_PATH,
    corePath: TESSERACT_CORE_PATH,
    langPath,
    workerBlobURL: false,
    cacheMethod: 'none',
    gzip: true,
    legacyLang: false,
    legacyCore: false,
  });
  try {
    const result = await worker.recognize(prepared);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
};

export async function recognizeWithOcrWorker(blob: Blob, language: string): Promise<OcrWorkerResult> {
  const prepared = await preprocessWithWorker(blob);
  const tesseract = await ensureTesseract();
  const requestedLanguages = languages(language);
  if (requestedLanguages.length === 0) throw new Error('No supported OCR language was requested.');
  const texts = await Promise.all(requestedLanguages.map((lang) => recognizeForLanguage(tesseract, prepared, lang)));
  return { text: texts.filter((text) => text.trim()).join('\n') };
}
