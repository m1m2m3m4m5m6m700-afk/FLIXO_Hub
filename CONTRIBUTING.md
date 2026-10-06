# Contributing to FLIXO_Hub

## Branch policy

The production authority is `main`. The integration authority is `execution`.

Operational branches:
- `main` — production/reference authority. Changes reach it only through the approved pull request path.
- `execution` — sole integration line for implementation, repair, testing, and agent work before promotion.

Controlled agent branches:
- Branches matching `agent-1/**`, `agent-2/**`, `agent-3/**`, `agent-4/**`, and the historical `agent3/**` compatibility prefix are coordination branches only.
- Controlled agent branches are untrusted for production and MUST NOT become deployment or certification authority.
- Unknown branch refs fail closed and are never treated as trusted production refs.
- Historical/stale coordination branches remain untrusted; physical deletion is an owner-side housekeeping action unless explicitly authorized.

Promotion remains exclusively:

`execution -> pull request -> required checks/review -> main`

No direct writes to `main`.

## Moving execution HEAD and agent work

The live `execution` HEAD may move while an agent is preparing a repair.

- A stale candidate must not retain certification authority.
- Agent work may be preserved as a durable Patch Capsule in the trusted control plane.
- Patch Capsules are reconciled onto the current `execution` HEAD before publication.
- Publication is serialized through the deterministic `assistantController` lane.
- Publication is non-force and fast-forward only; a moved head causes retry/reconciliation, never overwrite.
- Do not silently delete or repoint agent branches.
- Any candidate evidence is invalidated by repository mutation and must be regenerated on the new exact SHA.

## Delivery lifecycle

`Implement -> Verify -> Certify -> Freeze -> Promote`

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

`placeholder -> planned -> ready -> certified -> frozen baseline -> public`

A public tool must have a real runtime and the applicable automated regression/certification coverage.

## Definition of done

A change is complete when its implementation, tests, build/contracts, Evidence, certification decision, documentation, and release scope are all consistent with repository policy.
