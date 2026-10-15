# FLIXO Hub Copyright and License Provenance Register

**Status: OPEN — not a legal clearance or a claim that all rights have been verified.**

This register is an evidence checklist for the proposed Apache-2.0 release. A repository-wide license selection cannot grant rights that the project owner does not hold. Do not close any row based only on repository visibility, a green CI run, or the existence of a license file.

## Evidence register

| Scope | Required evidence | Status | Closure rule |
|---|---|---|---|
| Owner-created code and documentation | Identify authors/owners and the basis for the right to license each work | NOT VERIFIED | Record evidence and reviewer; isolate uncertain material |
| Historical contributions | Review contributors, commit history, pull requests, and contribution terms | NOT VERIFIED | Confirm each material contribution is licensed under compatible terms or obtain permission |
| Employer/contractor-owned work | Where relevant, written authorization from the rights holder or proof the contributor owns the work | NOT VERIFIED | Do not infer rights from GitHub account ownership |
| Third-party source/assets | File-level origin, upstream URL/version, license, copyright notices, modifications, and distribution obligations | NOT VERIFIED | Preserve required notices and resolve incompatibilities before distribution |
| Dependencies and bundled assets | Lockfile inventory plus production/runtime/bundled asset license review | INVENTORY AUTOMATION ADDED; CI AND MANUAL REVIEW PENDING | Review the generated `dependency-license-inventory.json` and `.md` artifacts; inspect bundled files separately and resolve every unknown/file-pointer license |
| Patent/trademark/brand content | Identify included marks, logos, datasets, models, and other assets and their terms | NOT VERIFIED | Confirm permitted use and required attribution; do not assume Apache-2.0 licenses trademarks |
| Apache NOTICE obligations | Inspect upstream licenses and notices for included components and distributions | NOT VERIFIED | Include required NOTICE content when applicable; do not invent an empty notice as proof |
| Per-file SPDX/REUSE metadata | Compare file headers and REUSE annotations against verified ownership and third-party licensing | IN PROGRESS | No blanket Apache annotation until the file-level inventory supports it |
| Release distribution | Confirm the published source/artifact carries the license and all applicable notices | NOT VERIFIED | Verify the exact promoted SHA and artifact contents |

## Preliminary dependency metadata finding

The initial inventory identified missing license metadata for the private workspace package `@flixo/contracts@0.1.0` and an obsolete `extraneous` lock entry for `@flixo/agent-runtime@0.1.0`. The candidate now declares `Apache-2.0` for the private contracts workspace in its package manifest and lockfile, consistent with the owner's selected project license. The inventory now excludes lock entries marked `extraneous` from the distributable dependency list and reports their count separately. These metadata fixes do not establish the legal provenance of all code inside the workspace, and CI must verify the exact resulting candidate.

## Required audit procedure

1. Export the full repository file list at the release candidate SHA, including hidden files, vendored code, assets, generated files, submodules, and nested packages.
2. Inventory contributors and relevant commit/PR history. Identify imported or copied code and any files with pre-existing SPDX or copyright notices.
3. Run `npm run audit:licenses`; retain the generated dependency license inventory artifacts and resolve every missing, `UNLICENSED`, or `SEE LICENSE IN` metadata entry. Then inspect production bundles and shipped assets; a package-manager audit is not a license audit.
4. Compare every detected license and notice with Apache-2.0 distribution requirements and document compatibility decisions.
5. Obtain written permission or isolate material where ownership or relicensing authority is uncertain.
6. Have a reviewer independent of the implementation verify the inventory and evidence.
7. Re-run required tests and protected promotion checks on the exact release SHA, then verify the distributed artifact.

## Important boundaries

- The owner's Apache-2.0 selection is a project decision, not proof of ownership of all content.
- GitHub public visibility and a successful CI run do not establish third-party copyright permission.
- New contribution rules apply prospectively and do not retroactively cure missing rights.
- This register is operational documentation, not legal advice. Obtain qualified legal review for unresolved ownership, compatibility, patent, or jurisdiction questions.
