# ADR 0001 — Engineering source of truth and exact-SHA certification

## Status

Accepted.

## Decision

The FLIXO tool and capability registry is maintained from src/lib/tools/tool-registry.ts. Legacy config modules remain compatibility facades until all consumers are migrated, but they must contain no independent definitions.

Release state is generated from the exact build SHA. Runtime certification artifacts under dist/attestations are generated during builds and verified in CI.

## Rationale

Multiple mutable definitions caused architectural drift risk. Manual certification files could also diverge from the binary actually being tested.

Centralizing metadata and generating certification from the immutable build identity makes the release chain auditable and deterministic.

## Consequences

Compatibility facades must eventually be removable. CI becomes a stronger dependency of release governance, and production evidence must remain tied to the exact commit being promoted.

## Non-goals

This decision does not require immediate deletion of all historical certification documents, replacement of existing product contracts, or invention of runtime telemetry that is not yet required by the product.
