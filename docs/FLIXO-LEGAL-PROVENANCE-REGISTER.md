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
| Dependencies and bundled assets | Lockfile inventory plus production/runtime/bundled asset license review | LOCKFILE METADATA CHECK PASSED; COMPATIBILITY AND BUNDLE REVIEW PENDING | Review the generated `dependency-license-inventory.json` and `.md` artifacts; inspect bundled files separately and resolve every unknown/file-pointer license |
| Patent/trademark/brand content | Identify included marks, logos, datasets, models, and other assets and their terms | NOT VERIFIED | Confirm permitted use and required attribution; do not assume Apache-2.0 licenses trademarks |
| Apache NOTICE obligations | Inspect upstream licenses and notices for included components and distributions | NOT VERIFIED | Include required NOTICE content when applicable; do not invent an empty notice as proof |
| Per-file SPDX/REUSE metadata | Compare file headers and REUSE annotations against verified ownership and third-party licensing | IN PROGRESS | No blanket Apache annotation until the file-level inventory supports it |
| Release distribution | Confirm the published source/artifact carries the license and all applicable notices | NOT VERIFIED | Verify the exact promoted SHA and artifact contents |

## Dependency inventory evidence

CI run `38763039401` for candidate SHA `73c26cff4dd40db3a4fde170c65452f65c735a83` completed the `Inventory dependency license metadata` step successfully and uploaded artifact `flixo-dependency-license-inventory-38763039401`. The retained report records 262 package entries, one workspace link ignored, one stale `extraneous` entry ignored, and zero entries with missing, `UNLICENSED`, or `SEE LICENSE IN` license metadata. This is a successful metadata completeness check only. It does not prove SPDX expressions are compatible with Apache-2.0, establish provenance or ownership, satisfy upstream NOTICE obligations, or audit bundled files.

## License-expression triage from the retained inventory

The exact-SHA report contains 12 distinct license expressions across 262 package entries. The largest groups are MIT (205 entries), Apache-2.0 (19), ISC (12), and MPL-2.0 (12). The following non-baseline expressions require explicit package/archive and distribution-scope triage before clearance:

| Locked package(s) | Expression | Scope in lockfile | Required manual check |
|---|---|---|---|
| `jszip@3.10.1` | `MIT OR GPL-3.0-or-later` | Runtime | Inspect the exact 3.10.1 archive, preserve its license/copyright files, and document the chosen MIT option if that is the selected distribution basis. Verify the shipped bundle and notices reflect the selected option. |
| `pako@1.0.11` | `MIT AND Zlib` | Runtime | Inspect the exact archive and preserve both required license texts/notices as applicable to the distribution. |
| `isbot@5.2.1` | `Unlicense` | Runtime | Inspect the exact archive and package origin/provenance; retain the license text and document how it is presented in source/binary distributions. |
| `lightningcss@1.33.0` plus 11 platform packages | `MPL-2.0` | Development-only; platform packages optional | Determine whether the CSS build tooling or any MPL-covered source/binary is shipped, not merely used during build. Inspect exact archive notices and bundle contents before deciding distribution obligations. |
| `caniuse-lite@1.0.30001809` | `CC-BY-4.0` | Development-only | Inspect the exact package and data origin; determine whether attribution is required for bundled data and place required attribution in the correct distribution surface. |
| `minimatch@10.2.6` | `BlueOak-1.0.0` | Development-only | Inspect the exact version's license text and confirm the package remains excluded from the delivered artifact or preserve its applicable notices. |
| `tslib@2.8.1` | `0BSD` | Runtime | Verify the exact archive's license text and preserve provenance metadata in the inventory/notices if required by the distribution scheme. |

The inventory also includes standard MIT, Apache-2.0, ISC, BSD-2-Clause and BSD-3-Clause expressions; presence of a permissive SPDX label does not establish copyright ownership, component provenance, or compatibility of every copied file. The inventory's `METADATA_PRESENT_NOT_LEGAL_CLEARANCE` status remains controlling for every package.

This triage is based on package-lock metadata, not a legal determination. Review actual package archives, transitive notices, generated bundles, copied assets and the intended distribution format before marking any item cleared.

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


## Candidate evidence refresh — 2026-10-15

For PR #1323 candidate `a2885a11f85c212454d644205701c39ee6935727`, CI run [38767780141](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38767780141) completed successfully for the listed PR-level engineering/security checks. The retained dependency inventory digest is `sha256:42a9312796957b87138bb2659ab6a763a70ceae064094ebe97786229d111cb31`; it remains metadata inventory evidence, not a legal compatibility opinion.

The PR review list was checked and contains no submitted reviews. The production model manifest remains empty, and strict model admission, protected promotion proof, and production deployment were skipped on this execution-targeted PR. Accordingly, the register remains OPEN. Do not close ownership, third-party notices, dependency compatibility, distribution artifact, or independent review rows based on CI success alone.


## Reproducible inventory artifact verification — 2026-10-15

For candidate SHA `042d54baa164658c64f5a00a080cf63c8b4a5e7c`, CI run [38775574603](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38775574603) succeeded on the execution-target PR. Artifact metadata returned by GitHub and independently recalculated hashes from the downloaded artifact agree:

- Artifact name: `flixo-dependency-license-inventory-38775574603`; artifact ID `11993077999`.
- ZIP SHA-256: `39df6c0b5b23ffcda145ff444443d7abadf7c09e93dcdae21260d22557a3484a`.
- Extracted `dependency-license-inventory.json` SHA-256: `ea6705c99a2ace5bae9d2417da39dc1825cb338e16ac4f202011f6951e520de9`.
- Extracted `dependency-license-inventory.md` SHA-256: `82a50d6c1be4315736e3ba9bdae652bedf523d7b0a40cb88d6d8c53bb6bcf01e`.
- Inventory counts: 262 package entries; 1 workspace link ignored; 1 stale `extraneous` lock entry ignored; 0 unresolved metadata entries.

The exact lockfile metadata also records `pako@1.0.11` as `(MIT AND Zlib)`, alongside `jszip@3.10.1` (`MIT OR GPL-3.0-or-later`), `isbot@5.2.1` (`Unlicense`), and 12 `lightningcss@1.33.0`/platform entries (`MPL-2.0`, marked development-only). These expressions and the status `METADATA_PRESENT_NOT_LEGAL_CLEARANCE` are preserved; no automated decision converts them to legally cleared status.

The inventory's own warning remains controlling: metadata coverage is not an audit of ownership, license compatibility, notices, or inclusion in the shipped artifact. The exact package archives, their license texts, the actual production bundle, the applicable notices, and the reason for including each package still need human review. This section improves the evidence trail but **does not close** the dependency/license row or the overall register.
