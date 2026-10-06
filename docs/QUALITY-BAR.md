# FLIXO Engineering Quality Bar

This document is normative. The repository is engineering-complete only when the automated quality bar is green on the exact commit being promoted.

## Architecture

The production tool and capability model has one source of truth: src/lib/tools/tool-registry.ts. Compatibility files under src/config are facades only and must not contain independent business logic.

The dependency direction is: UI → tool/application layer → domain/lib → contracts → infrastructure.

## Maintainability

Large modules are subject to hard byte budgets. A budget violation is a CI failure. The purpose is to prevent accidental growth of modules that already combine multiple responsibilities.

## Media resource lifecycle

Browser media resources follow Acquire → Use → Complete/Abort → Dispose.

The contract covers Blob URLs, ImageBitmap, Canvas/OffscreenCanvas backing stores, Workers, MediaStreams, MediaRecorders, animation frames, and AbortControllers.

## Testing

Release evidence combines static/type checks, contract tests, core tests, browser tests, security workflows, and exact-SHA build certification.

Critical media paths must cover failure, cancellation, cleanup, and oversized-input behavior in addition to successful execution.

## Security

Security-sensitive paths require ownership coverage through CODEOWNERS and CI verification. CodeQL, Secret Scan, dependency audit, and exact-SHA artifact verification remain blocking gates.

## i18n and SEO

The canonical locale set is exactly 20 locales and the locale verification gate must remain green. Localized routing, canonical URLs, hreflang, JSON-LD, sitemap, and robots generation remain contract-driven.

## CI/CD and release

A promoted commit must be traceable through commit → dependencies → tests → security → build → artifact → browser evidence → deployment identity.

Runtime certification is generated at build time. Manual certification markdown is historical evidence, not release state.

## 10/10 definition

10/10 means every category has an explicit invariant, an automated guard where technically possible, deterministic evidence, and no known critical exception hidden outside the release process.
