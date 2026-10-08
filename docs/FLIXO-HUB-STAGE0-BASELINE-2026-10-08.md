# FLIXO Hub — Stage 0 Baseline Audit

Date: 2026-10-08
Stage: 0 — Baseline & Repository Audit
Audit SHA: `72f22ae2b3d5f1852cb3f809a7197abe657d0ad9`
Canonical implementation lane: `execution`

## Executive finding

The existing repository is not yet compliant with the new FLIXO Hub privacy-first browser-local contract. It is an established browser-first AI editing product with additional server/admin/control-plane surfaces. The required implementation must therefore be an explicit migration/containment effort; it must not silently treat the current MVP as equivalent to the new file-tools contract.

## Current architecture observed

- React 19 + Vite + TypeScript strict.
- Canonical runtime currently includes `src/config/registry.ts`, `src/lib/execution/canonical-executor.ts`, and existing image/video tools.
- The current executable MVP is ten image/video capabilities, not the new image/PDF/OCR-only Hub scope.
- A Cloudflare Worker and admin/server/Supabase surfaces exist in the repository.
- Existing PWA/service-worker infrastructure exists under `public/sw.js`.
- The current build is not yet a pure static output contract because the repository also contains server/worker control-plane surfaces.

## Privacy/security gaps against the 2026-10-08 Hub contract

### 1. Third-party CDN references

Observed exact runtime references to jsDelivr in:
- `src/worker.ts` CSP `script-src` and `connect-src`.
- `vercel.json` CSP.
- `src/tools/image-toolkit/ocr-worker-client.ts`, which constructs a Tesseract script URL on `https://cdn.jsdelivr.net`.

Required state:
- No CDN/runtime third-party scripts.
- Tesseract worker/core/language data must be self-hosted.

### 2. Outbound telemetry

Observed `navigator.sendBeacon` use in:
- `src/lib/telemetry/telemetry-tracker.ts`.

Required state:
- No telemetry transport carrying user data.
- For the new Hub processing path, network tests must fail on any non-empty payload after initial asset loading.

### 3. Persistence boundary

Observed operational `localStorage` use in:
- `src/lib/tool-chain.ts`
- `src/lib/local-workspace.ts`
- diagnostics/performance runtime modules
- `src/tools/filter-mask/index.tsx`
- `src/components/OfficialHome.tsx`

Required state:
- Cookies/localStorage must not hold tracking or identity identifiers.
- Only explicitly allowed UI preferences may persist (language/theme).
- File bytes and processing intermediates belong in OPFS or a documented memory fallback, never in identifier-bearing persistence.

### 4. CSP mismatch

Current CSP allows:
`https://cdn.jsdelivr.net` in both script and connect directives.

Required target:
- `default-src 'self'`
- `script-src 'self'`
- `connect-src 'self'`
- plus only the minimum additional self-hosted directives needed for local WASM, workers, blobs and PWA assets.

### 5. Referrer policy mismatch

Current worker policy is:
`strict-origin-when-cross-origin`.

Required Hub contract:
- Referrer-Policy must emit no referrer.

### 6. Feature/runtime architecture

The repository does not yet expose the required dedicated Hub core contracts for:
- worker pool
- OPFS abstraction + fallback
- SIMD/OPFS/SharedArrayBuffer/WebGPU detection
- transferable task messaging

Existing worker execution can be reused selectively, but these contracts must be established without creating a second runtime authority.

## Dependency gate

No new dependency was added during Stage 0.

Existing direct production dependencies include React, Radix UI, TanStack Router, JSZip, Lucide, Motion and Zod. Their existing usage must be re-audited against the new static/privacy boundary before any dependency is retained or expanded.

New Hub dependencies are gated on:
1. exact version;
2. upstream/package license;
3. transitive licenses relevant to distribution;
4. WASM/model artifact license where applicable;
5. browser/runtime fit;
6. self-hosting feasibility.

## Scope collision

The current repository's canonical MVP is different from the Hub brief:

Current executable MVP:
`background-remover, image-upscaler, image-cropper, image-compressor, image-converter, image-effects, video-trimmer, video-cropper, video-resizer, video-compressor`

New Hub target:
- image compression/conversion;
- PDF merge/split/rotate/reorder;
- OCR Arabic/English;
- background removal with local ONNX model;
- PWA/offline;
- sponsor/pro placeholders without tracking.

This is a product-scope migration, not a safe incremental rename. Stage 1 must introduce the Hub boundary without silently modifying the existing canonical ten-tool governance contracts.

## Stage 0 disposition

PASS for audit completion: the baseline and migration boundary are now explicit.

NOT YET COMPLIANT with the Hub contract: the gaps above remain open and become Stage 1 implementation work.

## Stage 1 entry gates

Stage 1 may start only on the resulting exact execution SHA and must add:
- worker-pool core contract;
- OPFS + fallback contract;
- feature detection;
- Hub privacy/network contract tests;
- local-only CSP/headers;
- a minimal Hub page/privacy page;
- no new dependency until license evidence is recorded.
