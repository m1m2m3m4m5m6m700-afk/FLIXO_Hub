# RT-13 — OCR Supply Chain Closure

Tesseract.js main runtime and worker are vendored under exact versioned paths and loaded from same-origin application assets:

- Tesseract.js 6.0.1
- worker 6.0.1 at `/vendor/tesseract/6.0.1/worker.min.js`
- Tesseract core 6.0.0 exact package URL
- language data exact `4.0.0_best_int` paths for English and Arabic
- language package version 1.0.0
- `workerBlobURL=false`
- `cacheMethod=none`

There is no mutable `latest`, caret, tilde, branch, or floating main-runtime URL. The remaining external trust boundary is the exact-version jsDelivr core and language-data resources. Tesseract's upstream documentation identifies these versioned NPM/CDN resources and documents local hosting as an alternative. citeturn749369search0turn749369search5

The vendored runtime retains the upstream Apache-2.0 license. Regression coverage is in `tests/ocr-supply-chain.test.ts`.

No release certification is asserted.
