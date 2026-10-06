# TestSprite verification for FLIXO

TestSprite is an additional external browser verification layer for the current FLIXO product. Its committed suite focuses on the Manual Standalone Workflow; it does not replace or disable the certified Agent Guided Workflow. The execution workflow tests the checked-out `execution` SHA through a local TestSprite tunnel and fails closed.

## Required repository configuration

Set these once in the GitHub repository:

- Secret: `TESTSPRITE_API_KEY`
- Repository variable: `TESTSPRITE_PROJECT_ID`

The API key used for the local frontend path needs the TestSprite scopes required by the CLI, including `run:tunnel` and the permissions needed to read and create tests. Local V3 projects are required for `--local` frontend runs.

## Committed manual suite

The committed plan templates live under `.testsprite/plans/`.

They cover selected manual product surfaces. The Agent Guided Workflow remains a supported certified MVP workflow and is verified by the canonical Playwright release suite rather than these TestSprite plans:

1. The Arabic official homepage presents the browser-first, manual-only product and its featured executable tools.
2. Background Remover opens directly as a standalone manual browser tool without requiring an agent/chat workflow.

Agent-era remote TestSprite cases may remain in the external TestSprite project for historical reasons. They are not part of the current canonical suite and are not run by the execution workflow.

## Canonical execution workflow

`.github/workflows/testsprite-execution.yml` runs on every push to `execution`.

It:

1. Checks out the exact execution SHA.
2. Installs FLIXO dependencies and starts the local application.
3. Installs the pinned TestSprite CLI.
4. Validates every committed manual plan offline.
5. Fails closed when the required TestSprite repository configuration is missing.
6. Materializes the configured project id into runtime-only copies of the plans.
7. Lists the external project's existing frontend tests and creates only missing committed manual cases.
8. Resolves exactly one TestSprite test id for every committed plan and fails on zero or duplicate matches.
9. Runs only those resolved committed manual test ids through the local tunnel.
10. Requires at least two tests and a complete pass verdict with zero failed, skipped, or timed-out cases.
11. Uploads JUnit, summary, resolved test ids, runtime plans, and FLIXO startup-log evidence.

The workflow never treats an empty run, skipped test, stale agent test, or missing evidence as green.

## Local validation

The plan contract can be validated without network calls:

```bash
npm install -g @testsprite/testsprite-cli@0.4.0
testsprite test lint --plan-from-dir .testsprite/plans
```

The GitHub workflow performs the authenticated external reconciliation and local-tunnel execution because repository secrets and variables are required.

## Exact-SHA rule

A TestSprite result is evidence only for the GitHub Actions job that checked out that SHA. It must not be reused as evidence for a later `execution` SHA.

TestSprite is an additional behavioral verification layer; it does not replace FLIXO's typecheck, lint, build, unit, security, browser, trust-gate, or exact-SHA promotion-proof gates.
