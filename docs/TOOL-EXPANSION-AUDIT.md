# FLIXO Tool Expansion Audit

Audit baseline: execution `7a86c4a0a604340b2d1519e8be64ce6f298bee13` and main `263827228cbe5f4851470297fde5f2858ff844de`.

## Current registry
- Tool definitions remain broader than the MVP release surface.
- The ten-capability set is the currently authorized canonical executable release set for this certification.
- The broader ready/plannable catalog remains outside the MVP scope unless separately admitted.
- `TOOL_REGISTRY` is the canonical registry and `TOOL_CATALOG` is derived from it.
- `src/config/tools.ts` remains a compatibility surface; it is not a second source of definitions.

## Current registered IDs
filter-mask, image-compressor, background-remover, image-upscaler, image-converter, object-remover, watermark-remover, image-cropper, image-to-svg, image-ocr, background-blur, passport-photo-maker, watermark-adder, meme-generator, collage-maker, image-effects, exif-cleaner, svg-optimizer, mockup-generator, seed, pix, ai-image-generator, photo-colorizer, video-trimmer, video-cropper, video-resizer, video-compressor, image-resizer, image-hue, image-pixelate, image-padding, image-rounded-corners.

## Current canonical executable MVP IDs
background-remover, image-upscaler, image-cropper, image-compressor, image-converter, image-effects, video-trimmer, video-cropper, video-resizer, video-compressor.

The MVP release set is browser-local, canonical, schema-bound, verifier-bound, and adapter-bound. Additional ready/plannable routes remain outside the ten-tool executable scope unless separately admitted.

## Localization baseline
The repository declares 20 canonical locales:
ar, en, es, fr, de, hi, id, it, ja, ko, ms, nl, pl, pt, ru, sv, th, tr, uk, vi.
Automated dictionary structure/key coverage remains part of the required candidate verification. Full hardcoded UI-string migration is not a prerequisite for the frozen MVP unless the active certification gates require it.

## Dependency and privacy baseline
Production dependency audit is a required exact-candidate gate.
PDF, FFmpeg, advanced OCR/AI, and other heavy browser-local engines remain excluded until licensing, bundle, browser-compatibility, privacy, worker/cancellation, and verifier contracts are satisfied.
The strict no-upload claim is accepted only with exact-candidate browser/network evidence.

## Architecture boundary
The broader registry is not executable MVP scope merely because routes or definitions exist. Admission requires canonical capability state, executor binding, verifier, output contract, parameter schema, safety limits, local execution mode, and synchronized MVP scope evidence.
No second registry or alternate executor authority may be introduced.

## Historical notes
- The shared image-toolkit route crash caused by missing canonical `toolId` injection was repaired and promoted through PR #1000.
- Earlier production verification on main `263827228cbe5f4851470297fde5f2858ff844de` is historical and does not certify the current execution candidate.
- Historical localization and production results are retained for audit context only; they are not current candidate evidence.

## Current gate position
This audit does not certify the current MVP. No fixed PR number is authoritative for the active candidate; resolve the live `execution` HEAD and its active integration PR at verification time. PR #1002 is historical release-line context only. Current exact-SHA evidence must be regenerated after every execution mutation, and final release requires the Prompt 17 clean-clone gate, Prompt 18 freeze, Prompt 19 certification, required GitHub governance, legitimate human review, and Prompt 20 promotion through `execution -> main`.
