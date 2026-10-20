# FLIXO Hub — General Programming Platform Contract

STATUS: FOUNDATION / EXECUTABLE CONTRACT

## Purpose

FLIXO Hub is being extended from a browser-first tool product into a general programming platform that can help people build, test, verify, publish, reuse, and improve software.

The platform is not a second application with a second control plane. It is a product layer over the existing canonical execution, verification, CELL, evidence, and repository boundaries.

## Platform planes

1. Workspace — projects, files, configuration, local state and user-visible development context.
2. Repository — Git provider connections, source identity, branches, commits, issues and pull requests.
3. Execution — isolated ephemeral sandboxes, resource limits, network policy, cancellation and artifact production.
4. Verification — tests, type checks, lint, security, browser checks, release gates and Exact-SHA evidence.
5. Agents — delegated discovery, planning and execution through the CELL control plane; agents never become a second dispatch or certification authority.
6. Artifacts — immutable outputs with source SHA, build identity and digest evidence.
7. Collaboration — review, discussion, issue tracking, contribution history and maintainership.
8. Contribution — governed proposals for tools, agents, skills, templates, extensions and fixes.
9. Learning — evidence-based lessons and reusable engineering knowledge without silently granting new authority.
10. Value loop — users gain productivity and reusable assets; the platform gains verified capabilities, contributions and evidence-backed improvements.

## Non-negotiable security boundary

General programming execution is treated as untrusted code execution.

The default policy is:

- ephemeral workspace;
- no network unless explicitly allowlisted;
- hard CPU, memory, timeout and output limits;
- no browser-visible secret values;
- environment variables are brokered by key name;
- cancellation must terminate the execution slot;
- produced artifacts carry source identity and digest evidence;
- SHA drift invalidates pending execution evidence;
- mock or simulated execution may describe a boundary but cannot satisfy a release gate.

A provider is not considered connected until independent execution evidence proves the provider satisfies this contract.

## Authority model

`المهام.md` remains the dispatch authority.

`src/config` and the existing canonical executor remain product execution authority.

CELL remains the bounded agent control plane.

Verification remains independent from proposal generation.

Repository integrations are external evidence/providers. They do not become a second task ledger.

The new programming-platform registry is metadata and routing information. It cannot by itself authorize code mutation.

## Public contribution model

A contribution may propose:

- a project template;
- a developer tool;
- an agent;
- a skill;
- a verifier;
- a runtime adapter;
- a documentation package;
- a reusable workflow.

Admission follows:

`proposal → integrity validation → review → verification → publication → evidence → reuse`.

Reputation, marketplace placement, and revenue-related signals must be derived from verified events and cannot be fabricated by agents or clients.

## Definition of platform completeness

The platform is complete only when all ten planes have a real implementation, independent verification, operational evidence, documented failure paths, and a safe rollback/deletion policy.

The current release is a foundation: the workspace shell and core contracts are real; general remote execution and repository mutation remain bounded until their providers are connected and verified.
