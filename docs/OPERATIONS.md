# FLIXO Operations Standard

## Runtime identity

Every certified build carries its exact Git SHA in generated runtime identity files and in the build certification artifact. Deployment verification must compare runtime identity with the promoted SHA.

## Resource safety

Client-side image and video workloads are bounded by pixel, batch, worker, and timeout limits. Cancellation is a first-class execution path. Unmounted UI must not retain active workers, media streams, animation frames, or Blob URLs.

## Incident handling

Classify failures as application-code, test/verification, dependency/security, external-service, or deployment/infrastructure failures. Do not bypass a security or trust gate to mask one category as another.

## Release rollback

Rollback by immutable release SHA. Do not hot-edit production behavior outside the repository release path.

## Observability

Privacy-safe measurements should cover tool success/failure rate, processing latency, cancellation rate, worker failures, browser errors, and large-input rejection. Measurements must never expose secrets or raw user content.

## Ownership

Changes to CI, security contracts, deployment configuration, worker identity, or release attestation require CODEOWNERS review and fresh exact-SHA evidence.
