# FLIXO MVP Scope Decision Record

Status: CANONICAL
Decision date: 2026-10-05

## Decision

The Browser-First AI Editing MVP executable scope is exactly 24 canonical capabilities for this release lane: 20 browser-local image capabilities plus the existing 4 browser-local video capabilities.

Image:
- `background-remover`
- `image-upscaler`
- `image-cropper`
- `image-compressor`
- `image-converter`
- `image-effects`
- `image-resizer`
- `image-rotate-flip`
- `image-brightness-contrast`
- `image-saturation-hue`
- `image-exposure`
- `image-highlights-shadows`
- `image-sharpen`
- `image-blur`
- `image-grayscale-duotone`
- `image-filters`
- `image-watermark`
- `image-text-overlay`
- `image-draw-annotate`
- `image-redaction`

Video:
- `video-trimmer`
- `video-cropper`
- `video-resizer`
- `video-compressor`

## Execution Contract

All 20 image capabilities are browser-local and must route through the canonical registry and canonical image executor. Agent execution requires explicit user confirmation, rejects locked targets, rejects unknown tools, remains bounded by cancellation/timeout/retry limits, and fails closed on verifier failure. Raw `File`/`Blob` payloads are not sent to models, providers, or network transports.

## Certification Boundary

This decision freezes the executable release scope at 20 image tools plus the pre-existing 4 local video tools. The broader image/tool catalog remains outside this release gate.
