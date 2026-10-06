# FLIXO MVP Release Checklist

## Candidate identity

Record one candidate SHA only:

- Current execution SHA:
- Tested SHA:
- Built SHA:
- Browser-verified SHA:
- Security/CodeQL SHA:
- Coverage-certified SHA:
- Certified SHA:
- Deployed SHA:

All recorded SHAs must be identical before release promotion.

## Code and tests

- [ ] TypeScript clean
- [ ] ESLint clean
- [ ] Production build succeeds
- [ ] Core contract suite succeeds
- [ ] Deterministic MVP intent corpus is 100% exact
- [ ] Manual Standalone Workflow E2E succeeds
- [ ] No public or internal Agent runtime is shipped
- [ ] Manual-only fallback/error handling is verified
- [ ] Red-Team regression suite succeeds

## Runtime boundary

- [ ] All executable MVP capabilities are canonical
- [ ] Registry → execution gate → executor → verifier → artifact is the only execution path
- [ ] No raw File/Blob bytes are sent to providers
- [ ] No agent-planning provider path is shipped
- [ ] Local file execution requires no backend
- [ ] Resource, timeout, abort, file-size and pixel limits are enforced
- [ ] Manual execution fails closed when required proof cannot be established

## Security and trust

- [ ] CodeQL is successful on the candidate SHA
- [ ] Dependency/security audit is successful
- [ ] Secret scanning is successful
- [ ] Provider URL/response/request limits are enforced
- [ ] SSE/error handling does not expose internal exceptions
- [ ] Engineering agents have no merge/promotion/certification authority

## Governance

- [ ] Agent implementation policy is `Open Agent Execution Mode` on canonical `execution`.
- [ ] No agent branch or PR-to-`execution` workflow is required.
- [ ] PR targets `main` from `execution`
- [ ] Independent human review is present for release promotion when required by STRICT policy
- [ ] Code Owner policy is enforced where required
- [ ] Required status checks are strict
- [ ] `main` is protected
- [ ] No direct write to `main`
- [ ] No stale/cancelled/skipped evidence is accepted
- [ ] Routine agent development may use FAST governance; live release governance is still independently verified before certification
- [ ] Documented governance must match the selected live governance mode; text cannot substitute for ruleset enforcement

## Deployment

- [ ] Deployment source is current `main`
- [ ] Build artifact carries the exact release SHA
- [ ] Cloudflare worker target is `flixoai`
- [ ] Production immutable identity matches the release SHA
- [ ] Production root returns valid HTML
- [ ] Production browser smoke succeeds
- [ ] Deployed SHA equals certified SHA

## Release freeze

After candidate freeze, allow only bug fixes, security fixes, contract-correct test fixes, and documentation corrections. Feature work starts a new release cycle.


## Agent Fast Path
Routine implementation, repair, testing, and branch isolation do not require per-file approval, fixed preflight counts, mandatory handoff, or lease/heartbeat coordination. These are development workflow controls, not release certification controls.
