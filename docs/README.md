# FLIXO Hub Documentation

This directory is the documentation index for developers, contributors, operators, and reviewers.

## Start here

- [Repository README](../README.md) — product purpose, quick start, architecture, and current boundaries.
- [Contributing](../CONTRIBUTING.md) — branch policy, evidence, certification, and contribution rules.
- [Support](../SUPPORT.md) — help routing and public issue guidance.
- [Accessibility](../ACCESSIBILITY.md) — accessibility targets and barrier reporting.
- [Security](../SECURITY.md) — vulnerability reporting, secret handling, and security gates.
- [Code of Conduct](../CODE_OF_CONDUCT.md) — community behavior expectations.
- [Citation](../CITATION.cff) — machine-readable citation metadata.

## Developer platform

- [Contribution contract](CONTRIBUTIONS.md) — reusable contribution lifecycle and exact-SHA admission requirements.
- [Agent documentation](agents/README.md) — agent roles, boundaries, and execution guidance.
- [Patch Capsule and CAS](AGENT-PATCH-CAPSULE-AND-CAS.md) — race-safe agent work preservation and publication rules.

## Public project health

The repository's community-health workflow checks the local community contract on every relevant repository update and performs a read-only audit of externally configured repository metadata. Administrative settings that GitHub does not expose to the repository token are reported as external actions rather than being silently treated as complete.

The target external configuration is documented in [GitHub metadata setup](GITHUB-METADATA-SETUP.md).
