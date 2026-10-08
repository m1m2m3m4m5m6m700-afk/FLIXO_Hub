# FLIXO Hub — Architecture Decisions

This file records technical decisions for the 2026-10-08 FLIXO Hub implementation stream.

## Decision 001 — Treat Hub privacy contract as a new execution boundary

Date: 2026-10-08
Status: ACCEPTED
Context: The existing repository is a larger browser-first editing platform with video capabilities, Cloudflare Worker/admin/control-plane code, CDN references, telemetry transport and broader persistence. The new Hub brief requires a static browser-local file-tools surface with no third-party scripts and no user-file egress.
Decision: Build the Hub as an explicit browser-local execution boundary and do not silently redefine or delete the existing canonical ten-tool MVP during Stage 1. The Hub boundary must own its worker, OPFS, feature-detection, privacy and network contracts.
Consequence: Existing control-plane/runtime code can remain outside the Hub boundary until separately migrated or retired through an explicit task. Hub processing code must not import a server/admin execution path or remote file-processing adapter.

## Decision 002 — No new dependency before license evidence

Date: 2026-10-08
Status: ACCEPTED
Decision: Every new package, WASM module, model and language-data artifact must be admitted only after exact-version provenance and license review, including relevant transitive obligations. LGPL/AGPL and restrictive model/artifact licenses require an explicit compatibility decision before adoption.
Consequence: Stage 0 adds no runtime dependency. Existing dependencies are retained only where they are already part of the repository until their Hub-specific usage is validated.

## Decision 003 — Self-hosting is the only acceptable runtime delivery path

Date: 2026-10-08
Status: ACCEPTED
Decision: Runtime JS, CSS, fonts, WASM, OCR workers/core/language data and ML models used by Hub tools are served from the application's own origin and build output. CDN/runtime URL references are prohibited.
Consequence: The current jsDelivr Tesseract path and CDN CSP allowances are explicit Stage 1 migration targets.

## Decision 004 — Persistence is capability-limited

Date: 2026-10-08
Status: ACCEPTED
Decision: OPFS is the primary persistence mechanism for large file data and intermediates. The fallback is memory/Blob based. localStorage is reserved for language/theme preferences and must not contain tracking identifiers, user file bytes or processing artifacts.
Consequence: Existing operational localStorage and telemetry persistence paths are outside the Hub contract and must not be reused by Hub processing.

## Decision 005 — Evidence must be measured on the exact resulting SHA

Date: 2026-10-08
Status: ACCEPTED
Decision: A stage is not complete from source inspection alone. Build/test/network/browser evidence is generated against the exact commit under review and is invalidated by later execution mutations.
Consequence: Every Stage 1 change will trigger fresh targeted tests and CI evidence before stage closure.
