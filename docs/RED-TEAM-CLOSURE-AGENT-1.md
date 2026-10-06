# FLIXO Hub — Red Team Closure — Agent 1
## RT-08 / RT-12 / RT-13

**Agent lane:** agent-1/redteam-closure-20261006  
**Integration target:** execution  
**Report commit:** this file is the final mutation in the Agent 1 closure lane.  
**main:** unchanged throughout this lane.

## RT-08 — Historical Credential Exposure

### Root cause

Full-history Gitleaks scanning is correctly treating historical non-empty credential-like material as security-relevant. The prior allowlist only covered two known non-secret historical detections and therefore did not account for newer historical detections.

### Historical findings and classification

The exact-SHA scan at `16196397f3490a73f6e58f5dda212345628c5144` scanned 16,957 commits and reported four findings. Secret values were never written to this report or logs.

| Historical finding | Classification | Disposition |
|---|---|---|
| `a4d85af76b8dc19116ebb1043fb1cafeb36fbe54` — `scripts/ci/test-chair1-central-lease-adversarial.mjs` — `FLIXO_CHAIR_SIGNING_KEY` | **Test credential**; static non-empty credential-like material in an adversarial test commit | **Owner Action**: revoke/rotate the historical key externally; no repository evidence can prove revocation |
| `9ed9a5f1a518defb915f1391a0c03f7e6d925a44` — `scripts/ci/test-auto-repair-chair1-audit.mjs` — approval-signature expression | **False positive / code expression**, not a persisted credential | Narrow commit+path allowlist added |
| `d034d5a06bdedf2c924bfd86a700d00461b46ca0` — `.env.example` | **Configuration value** (endpoint URL), not a secret | Narrow commit+path allowlist added |
| `112bc0d8d4d104a4ade23aef8daf69a09379a9cc` — `المهام.md` | **False positive / task prose marker**, not a credential | Narrow commit+path allowlist added |

### Remediation

`.gitleaks.toml` now keeps only narrowly scoped historical exceptions:
- exact commit + exact path for the two original demonstrated non-secret findings;
- exact commit + exact path for the historical test-expression false positive;
- exact commit + exact path for the `.env.example` endpoint configuration;
- exact commit + exact path for the task-prose false positive.

No broad `.env`, credentials, or directory-wide bypass was added.

`.github/workflows/secret-scan.yml` now:
- scans full history with `fetch-depth: 0`;
- verifies the exact checkout SHA;
- scans the PR candidate SHA;
- scans `execution`;
- scans `main`;
- uses pinned Gitleaks 8.30.1 with SHA-256 verification;
- runs with `--redact`;
- records only redacted metadata when a finding exists.

### Exact evidence

At SHA `16196397f3490a73f6e58f5dda212345628c5144`, all three scan jobs verified their exact target checkout successfully, but the scan reported four findings. After narrowing the false-positive allowlists, commit `bc8562bebb5e348a56f728210a8b896bfef06da4` was produced. A new exact-SHA scan was triggered; its final result was not observed before this report mutation and is therefore not claimed as PASS.

### RT-08 disposition

**OWNER_ACTION**

Reason: one historical test credential remains treated as compromised until externally revoked/rotated. This is an external security action and cannot be proven solely from repository state.

## RT-12 — Tool Safety Consistency

### Root cause

Several legacy browser media paths admitted files with MIME-prefix checks or performed decoding before the canonical byte/signature and dimension contract had been applied.

### Remediation

The canonical browser boundary was strengthened in:
- `src/lib/contracts/browser-file-safety.ts`

It now:
- reads all file bytes before decode;
- applies canonical MIME, size, extension and signature checks;
- decodes only after byte validation;
- verifies decoded width/height and pixel ceilings;
- closes ImageBitmap resources;
- falls back safely to the HTML image decoder where needed.

Direct dependants were hardened:
- `src/tools/seed/index.tsx`
- `src/tools/pix/index.tsx`
- `src/components/image-tool/ToolWorkbench.tsx`
- `src/tools/image-compressor/file-safety.ts`
- `src/tools/image-compressor/engine.ts`
- `src/tools/image-compressor/compressor.worker.ts`
- `src/tools/image-toolkit/index.tsx`
- `src/tools/_shared/browser-image.tsx`

Seed main-image and Double Exposure inputs now use the canonical browser safety gate. Seed PNG export is integrity-checked before download.

Pix input is validated before object URL/decode. Pix PNG export is validated before download.

The shared ToolWorkbench validates inputs before asset insertion/decode and validates raster outputs before download.

The compressor now performs full-byte preflight before `createImageBitmap` on both main-thread and worker paths, while preserving SVG support with a safe decode fallback.

Legacy shared image paths now validate SVG as UTF-8 content and raster media through the canonical browser safety gate. Downloadable outputs are checked for safe filename, MIME, size, signatures where applicable, and decoded dimensions where available.

### Adversarial regression coverage

`tests/rt12-adversarial-browser.spec.ts` covers Seed and Pix:
- fake MIME;
- signature mismatch;
- oversized input;
- excessive decoded pixels;
- malformed image payload;
- extension mismatch.

`tests/redteam-agent1-closure-controls.test.ts` prevents reintroduction of MIME-prefix-only admission and checks canonical gate wiring.

Existing Seed/Pix/image-compressor browser suites remain included in the Agent 1 exact-SHA browser workflow.

### RT-12 disposition

**CLOSED**

Implementation and adversarial regression controls are committed. The dedicated exact-final-SHA browser workflow is the authoritative execution evidence; no stale browser PASS is reused.

## RT-13 — OCR Supply Chain

### Root cause

The prior OCR runtime path permitted mutable third-party runtime loading through moving CDN defaults.

### Remediation

Tesseract.js main runtime and worker are now vendored locally:
- `public/vendor/tesseract/6.0.1/tesseract.min.js`
- `public/vendor/tesseract/6.0.1/worker.min.js`
- `public/vendor/tesseract/6.0.1/LICENSE.md`

OCR client configuration is pinned to:
- Tesseract.js 6.0.1;
- Tesseract.js Core 6.0.0 exact URL;
- English data package 1.0.0 / `4.0.0_best_int`;
- Arabic data package 1.0.0 / `4.0.0_best_int`;
- local same-origin main runtime;
- local same-origin worker path;
- `workerBlobURL=false`;
- `cacheMethod='none'`;
- no `latest`, caret, tilde, branch, or floating main-runtime URL.

The browser-loaded main runtime is therefore not dependent on a moving CDN URL. The remaining explicit external trust boundary is the exact-version core and language-data URLs.

### Regression coverage

`tests/ocr-supply-chain.test.ts` asserts:
- exact version constants;
- exact local main/worker paths;
- exact core/language URLs;
- rejection of mutable version patterns;
- `workerBlobURL=false`;
- `cacheMethod='none'`;
- existence and size of vendored runtime assets.

### RT-13 disposition

**CLOSED**

No mutable OCR main-runtime URL remains in the loading path.

## Exact Agent 1 Implementation Commits

- RT-12 browser safety boundary: `0c246828217500a1af7657fcfb8b9c487ff364a1`
- Seed hardening: `6cf706af644cf571dc08b045a3408adae34db941`
- Pix hardening: `e3c6b4e5e88152539f730e83a5ad84d49d15db93`
- ToolWorkbench hardening: `44ed879fd46cdd6b6589fe33c12bfc64dc2274f8`
- Compressor byte preflight: `94a2f7813aded9ebbd23d666195793bc80488c3a`
- Compressor engine preflight: `0ec997eab40735d10e051acb26bc31832d278326`
- Compressor worker preflight: `6de8507569a5a2e6bd26227c3ca6ab9f2d4d85cc`
- Shared legacy image hardening: `c05492237d99aadca86cfda2533eea064d16fa9b`
- Image-toolkit output validation: `667704a77ad14f25ffd756e7bafbfaaad6b9440`
- RT-13 vendored main runtime: `6d4c86bca6a9f1a561219c7c7ba37807c495074d`
- RT-13 vendored worker: `fc70d0f26885dc39bff10e2706016d7fa18884a5`
- RT-13 client pinning: `ba2f3cf0680f6eb5752ee54cc282c214c1e18561`
- RT-13 regression: `f952634e670911459263e78a65a7abf6c705e38d`
- RT-08 scan policy: `897ecc7fa4008be2a2692f5a17d0f7572cf2c093`
- RT-08 redacted diagnostic scan: `16196397f3490a73f6e58f5dda212345628c5144`
- RT-08 narrowed false-positive allowlists: `bc8562bebb5e348a56f728210a8b896bfef06da4`

## Validation State

The final report commit itself is the authoritative final branch state.

No stale PASS is carried forward after mutation.

The exact-final-SHA GitHub validation must establish:
- Secret Scan final state;
- RT-12 targeted browser state;
- RT-13 pinning tests;
- build/lint/typecheck;
- affected public browser surfaces.

At report creation time, these final-SHA executions had not all produced final conclusions, so this document records them as validation pending rather than inventing PASS results.

## Final state

`RT-08=OWNER_ACTION`

`RT-12=CLOSED`

`RT-13=CLOSED`

No production/release certification is asserted.
