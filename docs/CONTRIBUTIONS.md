# FLIXO Contributions

FLIXO accepts reusable contributions as Git-hosted artifacts. The contribution center at /developer/contributions is the discovery surface; Git remains the source of truth for code, manifests, tests, provenance, and Exact-SHA evidence.

## Contract

A contribution has a stable slug, semantic version, explicit kind, contributor, license, source paths, usage docs, applicable tests, and exact-SHA evidence.

Lifecycle:

PROPOSED → VALIDATING → VERIFIED → PUBLISHED → DEPRECATED

CORE_REFERENCE is reserved for first-party examples.

## Hosting layout

    contributions/<slug>/
      contribution.json
      README.md
      src/
      tests/

A contribution may extend supported platform surfaces, but it must not create a second registry, executor, verifier, certification authority, or bypass the protected execution → main path.

## Admission

Use the Contribution proposal flow at /developer/contribute. The resulting work enters the normal Git/PR lifecycle. Registry admission does not certify the artifact.

Publication requires fresh evidence on the candidate SHA. SHA drift invalidates candidate-specific evidence and requires revalidation.

## Reuse

Published contributions should document purpose, compatibility, dependencies, license, reuse instructions, verification evidence, and known limitations.

Publication makes a contribution discoverable and reusable within its documented boundary. It does not grant merge, deployment, certification, or governance authority.
