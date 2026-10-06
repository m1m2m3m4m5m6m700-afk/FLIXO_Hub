# FLIXO Hub — Product / Legal Decision Record

Status: BLOCKED_PENDING_OWNER_DECISION
Last updated: 2026-10-06

This record contains decisions that the repository agents are explicitly not authorized to make.

## Decision 1 — MVP workflow

Choose exactly one:

### Option A — Manual-Only
- Public/product contract: Manual Standalone Workflow only.
- Agent Guided Workflow is not an MVP product promise.
- README, GPT, MVP scope contract, intent-router expectations, agent contracts, execution plan, tests, and public claims must be normalized to Manual-Only after approval.
- Any agent-guided implementation that is not required by the approved scope should be removed, disabled, or explicitly classified outside the MVP according to the owner's decision.

### Option B — Agent Guided + Manual
- Public/product contract: both workflows are supported.
- Agent Guided Workflow must require explicit confirmation before executable local actions.
- Manual Standalone Workflow remains independently usable.
- README, GPT, MVP scope contract, intent-router expectations, agent contracts, execution plan, tests, and public claims must be normalized to this dual-workflow contract after approval.

Owner decision: PENDING.

## Decision 2 — Public MVP capability count

Choose exactly one:

### Option A — Ten capabilities
The public MVP claim is the current ten-capability set:
- background-remover
- image-upscaler
- image-cropper
- image-compressor
- image-converter
- image-effects
- video-trimmer
- video-cropper
- video-resizer
- video-compressor

### Option B — Six image capabilities
The public MVP claim is restricted to the historical six-image set:
- background-remover
- image-upscaler
- image-cropper
- image-compressor
- image-converter
- image-effects

The four video capabilities may remain implemented internally, but they must not be included in public MVP claims unless separately approved.

Owner decision: PENDING.

## Decision 3 — Dead backend surface

Choose exactly one:

### Option A — Remove
Remove the unused/dead backend/admin surface and its unnecessary configuration, including the paths specified by the closure directive. Update tests and documentation accordingly.

### Option B — Activate
Keep the backend/admin surface and harden it to the required production contract, including real ai-image-generator behavior or registry disablement, shared rate limiting, safe client-IP handling, and mandatory production CSRF secret configuration.

Owner decision: PENDING.

## Decision 4 — Code license

Choose a license for repository code, or explicitly choose to keep the repository unlicensed/private until a later owner decision.

Owner decision: PENDING.

## Decision 5 — Support channel

Choose the official support channel/identity. Do not infer or invent an email address, URL, or organization identity.

Owner decision: PENDING.

## Decision 6 — Security reporting channel

Choose the official private security-reporting channel (for example, a security contact or platform mechanism) and its disclosure policy. Do not infer or invent one.

Owner decision: PENDING.

## Agent rule

Until the owner records decisions above, agents must not:
- select an option;
- rewrite contradictory product claims;
- delete or activate the backend surface;
- invent licensing, support, or security-reporting identity;
- declare release certification.

Once the owner records the decisions, the corresponding normalization/hardening phases may proceed.
