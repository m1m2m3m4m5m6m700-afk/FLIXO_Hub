# FLIXO Red-Team Closure — Agent 3A / RT-17

STATUS: RT-17=OWNER_ACTION
CLASSIFICATION: REMEDIATION / EVIDENCE RECORD — NOT RELEASE CERTIFICATION
REPOSITORY: m1m2m3m4m5m6m700-afk/FLIXO_Hub
BRANCH: agent-3a/redteam-rt17-20261006
INTEGRATION_TARGET: execution
START_SHA: a6feb563eb6d53e30badc0b071cadc805b71e0af
VALIDATED_CODE_SHA_BEFORE_REPORT: bd17cbfd1d84c8f1424be0e2d1e2dfed9bc36189

## RT-17 finding

| Finding | Disposition | Remediation | Exact SHA | Tests | Remaining Owner Action |
| --- | --- | --- | --- | --- | --- |
| RT-17 | OWNER_ACTION | Added explicit CODEOWNERS coverage and fail-closed syntax/coverage tests; replaced hard-coded main-ruleset lookup with live dynamic ruleset discovery; wired governance guards into the normal test/CI path. | `bd17cbfd1d84c8f1424be0e2d1e2dfed9bc36189` | CODEOWNERS coverage, malformed-rule failure, missing-coverage failure, real-path assertions, dynamic-ruleset verifier regression, security governance suite, CI guard | Owner/admin must harden the live `main` ruleset and obtain legitimate independent human approval. |

## Coverage exists vs enforcement

### CODEOWNERS coverage exists

`.github/CODEOWNERS` now explicitly covers the following existing high-impact paths with the intended repository owner:

- `/.github/workflows/`
- `/.github/CODEOWNERS`
- `/.github/agents/`
- `/scripts/ci/`
- `/SECURITY.md`
- `/supabase/`
- `/api/admin/`
- `/src/server/admin/`
- `/src/config/registry.ts`
- `/src/lib/contracts/`
- `/src/lib/execution/`
- `/src/lib/agent-guided-runtime.ts`
- `/src/worker.ts`
- `/wrangler.jsonc`
- `/vercel.json`

`/src/lib/media/` is absent from the repository at the validated SHA, so no ownership rule was invented for it. The existing media implementation is under `src/lib/video/`.

Automated validation proves:

- CODEOWNERS file exists and has parseable rules.
- Every active rule has a pattern and at least one GitHub owner token.
- Duplicate patterns fail closed.
- Required paths must exist and have explicit owner entries.
- Owner resolution must equal `@m1m2m3m4m5m6m700-afk`.
- Removing a required entry makes the test fail.
- A malformed rule makes the test fail.
- A global `*` fallback is allowed but does not replace explicit high-impact entries.

### GitHub Code Owner enforcement is mandatory

Live ruleset inspection was performed against the GitHub API at verification time.

Live state:

- Ruleset: `FLIXO-MAIN-PROTECTION`
- ID: `23854302`
- Enforcement: `active`
- Target: `refs/heads/main`
- Deletion protection: present
- Non-fast-forward protection: present
- Required approving reviews: `0` — required: `1`
- Code Owner review: `false` — required: `true`
- Stale-review dismissal on push: `false` — required: `true`
- Latest-push approval: `false` — required: `true`
- Review-thread resolution: `false` — required: `true`
- Required status checks: present (`trust-gate`, `Exact-SHA promotion proof`)
- Strict required status checks: `false` — required: `true`
- Direct source-restriction rule in the live ruleset: not present in the inspected ruleset model.
- The `Exact-SHA promotion proof` workflow contains the allowed-main-source rule (`execution`, with the explicit Dependabot exception), but the live ruleset currently does not make the required checks strict.
- Bypass actors: empty.

Therefore:

`CODEOWNERS coverage exists` = YES

`GitHub Code Owner enforcement is mandatory` = NO

The repository must not claim mandatory Code Owner enforcement until the live ruleset is hardened.

## Automated guards

Added/strengthened:

- `scripts/verify-codeowners-coverage.mjs` — static, fail-closed CODEOWNERS parser and explicit coverage validator.
- `scripts/ci/verify-main-ruleset.mjs` — dynamically discovers active `main` rulesets and validates live enforcement; it no longer hard-codes ruleset ID `23854302`.
- `tests/security-governance.test.ts` — syntax, missing-coverage, owner-resolution, path-existence, absent-media-path, branch-policy, and dynamic-ruleset regression tests.
- `package.json` — `verify:codeowners` is part of the normal `npm test` path.
- `.github/workflows/ci.yml` — CODEOWNERS guard runs in CI and an RT-17 live-governance job runs for `agent-3a/redteam-rt17-*`.
- `scripts/ci/verify-branch-policy.mjs` — narrowly admits the exact RT-17 coordination namespace `agent-3a/redteam-rt17-*` without opening a generic `agent-3a/*` namespace.

## Evidence rule

Every mutation after `VALIDATED_CODE_SHA_BEFORE_REPORT` invalidates candidate-specific runtime/CI evidence from the previous SHA. This report itself is a documentation mutation and is therefore not a certification artifact.

## Owner action required

1. Harden the live `FLIXO-MAIN-PROTECTION` ruleset to require at least one approving review.
2. Enable required Code Owner review.
3. Enable stale-review dismissal after push.
4. Enable latest-push approval.
5. Enable review-thread resolution.
6. Enable strict required status checks.
7. Keep `trust-gate` and `Exact-SHA promotion proof` required.
8. Ensure the allowed main PR source restriction remains enforced through the required promotion proof check (`execution`, with the existing explicit Dependabot exception), or add an equivalent native repository control if available.
9. Obtain a legitimate independent human approval; automation/comments do not substitute for owner approval.
10. Re-run all exact-SHA release/governance evidence after the ruleset change.

## Prohibited conclusions

This record does not certify FLIXO Hub, `execution`, `main`, production readiness, or the overall release.

`CERTIFICATION=FORBIDDEN`
