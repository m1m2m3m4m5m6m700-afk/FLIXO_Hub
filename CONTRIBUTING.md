# Contributing to FLIXO_Hub

## Branch policy

The repository has two operational branches and a controlled agent coordination lane:

- `main` — production/reference branch. Changes reach it through a pull request after the required certification gates pass.
- `execution` — the sole operational development, repair, testing, and integration line.
- `agent-1/*`, `agent-2/*`, and `agent-3/*` — short-lived controlled coordination branches for isolated agent work and pull requests back to `execution`. They are not production lines and may never promote directly to `main`.
- No other development, repair, test, diagnostic, agent, or temporary branch may be created or used.
- `main` is the production/reference destination and is never mutated directly.

Promotion is exclusively `execution → main`. Historical refs are not execution paths.

### Moving execution HEAD and agent work

The live `execution` HEAD may move while an agent is preparing a repair.

- A stale candidate must not retain certification authority.
- Agent work may be preserved as a durable Patch Capsule in the trusted control plane.
- Patch Capsules are reconciled onto the current `execution` HEAD before publication.
- Publication is serialized through the deterministic `assistantController` lane.
- Publication is non-force and fast-forward only; a moved head causes retry/reconciliation, never overwrite.
- Controlled coordination branches must remain under the `agent-1/*`, `agent-2/*`, or `agent-3/*` prefixes.
- The Patch Capsule workflow is documented in `docs/AGENT-PATCH-CAPSULE-AND-CAS.md`.

## Delivery lifecycle

`Implement → Verify → Certify → Freeze → Promote`

```text
execution
    ↓
Implement
    ↓
Fast → Medium → Functional → Browser Critical → Stability → Full
    ↓
Evidence Integrity
    ↓
Release Decision
    ↓
CERTIFIED
    ↓
Pull Request
    ↓
main
```

## Pull request rules

Every production PR must have a bounded scope, current Evidence, valid Gate Manifests, and a Release Decision appropriate to its scope. Evidence must match the certified commit and run and must not be expired or tampered with.

## Certification rules

An artifact or tool is not production-ready merely because its UI or route exists. For release certification, the required gates must pass and the Release Decision must be `CERTIFIED` for the current commit/run.

Required evidence fields include:

```text
commit
runId
gate
sha256
createdAt
expiresAt
```

## Baselines

Certified tools keep their baseline under:

```text
baselines/<tool>/certification-baseline.json
baselines/<tool>/provenance.json
```

A frozen baseline is immutable. A transient re-run is a re-validation, not a new baseline. A new baseline requires a full re-certification.

## CI and re-runs

Gates should be independently executable where practical. When a gate fails, re-run the failing job rather than successful upstream gates. Final release validation must reject missing, stale, mismatched, expired, or tampered Evidence.

## Security

Do not commit secrets, disable security gates to obtain green CI, or use forceful dependency changes as a blind workaround. External service failures such as deployment quotas must be classified separately from application-code failures.

The current release gate does not rely on a Socket workflow. The blocking security path is defined by the active CI/release plan (dependency audit, CodeQL, secret scanning, and Red-Team checks). Any future third-party supply-chain scanner must be explicitly added to the release plan and required workflow before it becomes a release gate.

## Tool lifecycle

```text
placeholder → planned → ready → certified → frozen baseline → public
```

A public tool must have a real runtime and the applicable automated regression/certification coverage.

## Definition of done

A change is complete when its implementation, tests, build/contracts, Evidence, certification decision, documentation, and release scope are all consistent with the repository policy.
