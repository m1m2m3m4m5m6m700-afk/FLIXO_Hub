# FLIXO Hub — Local Offline Edition

Status: implementation proposal; the generated package must be built and tested on one exact source SHA.

## Goal

Provide a local static copy of the browser-first FLIXO Hub interface and its bundled assets. Runtime serving uses Node.js built-in modules only. It does not require Vercel, Cloudflare, Supabase, a hosted model provider, analytics, or a third-party static-file server.

## Build and package

On a machine with the repository source, Node.js 22.x, and the project's npm dependencies installed:

1. Run npm ci --no-audit --no-fund when dependencies are available.
2. Run npm run build for typecheck, lint, Vite build, and generated-route artifacts.
3. Run npm run package:local.
4. Copy artifacts/flixo-local-site/ to the target computer.
5. Run node server.mjs inside that directory and open http://127.0.0.1:4173.

The generated package contains the built site/ directory, a dependency-free local HTTP server, an Arabic startup guide, and SHA-256 hashes for the static files. The package script fails closed if built HTML or CSS contains external runtime resource references.

## Offline/security behavior

The local server binds to loopback by default, applies a restrictive Content Security Policy with connect-src 'self', and returns 404 for /api/*. It serves the built single-page app and local assets only. It does not silently proxy requests to hosted services.

Browser-local tools can run only to the extent their required browser APIs and bundled assets are present. Features requiring remote accounts, cloud persistence, hosted AI, analytics, or server APIs are unavailable in this edition and must not claim success.

## No-external-product interpretation

The generated runtime bundle has no required external product/service connection. The source build still uses the project's npm dependencies and Node.js toolchain; those dependencies are third-party software with their own license terms. A truly dependency-free source build is a different engineering project and is not claimed here.

## Acceptance gates before calling this edition complete

- Build and package scripts succeed on the same exact source SHA.
- The generated service-worker cache list covers all static files, excludes API paths, and passes SHA-256 verification.
- Every emitted HTML/CSS resource reference is local or embedded.
- Local smoke test confirms home page and nested SPA routes return successfully.
- API routes fail closed; no external network connection is made during core local workflows.
- Browser tests cover local-first core workflows and explicit unavailable states.
- Package file hashes are verified.
- Applicable source, dependency, font, icon, media, and asset licenses are reviewed before redistributing the bundle.
- This local edition is not a production release certificate and does not clear the separate public-launch legal gate.
