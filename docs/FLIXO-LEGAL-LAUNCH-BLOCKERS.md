# FLIXO Legal / External Launch Blockers

**Status:** `BLOCKED_WITH_EVIDENCE`

This file distinguishes repository metadata changes from legal rights evidence. Automation must not represent unverified rights or external-account actions as complete.

## Repository code license: metadata reconciled; rights provenance remains open

**Current repository license decision for this candidate: retain GNU AGPL v3 only (`AGPL-3.0-only`) and do not relicense to Apache-2.0.** This is the least-assumptive option because the root `LICENSE` contains the GNU Affero General Public License version 3 text and `package.json` already declares `AGPL-3.0-only`. `CITATION.cff` is being aligned to that existing declaration. The previous Apache-2.0 target is not treated as authorized: the available repository evidence does not establish permission to relicense every covered contribution and third-party material.

This metadata alignment resolves the specific AGPL-versus-Apache declaration mismatch; it does **not** certify the complete copyright chain, dependency compliance, or all distribution obligations.

Required evidence before claiming legal clearance:
1. Run the repository's legal-license tests and dependency/license inventory on the exact candidate SHA.
2. Review dependency, asset, font, icon, model, and bundled-artifact notices; record exceptions and manual-review outcomes.
3. Verify contribution provenance and required copyright notices. If any material is not covered by the project's chosen license or lacks a compatible grant, isolate it or obtain documented permission before distribution.
4. Confirm the distribution and network-use obligations applicable to the actual deployment model, including the AGPL source-offer requirements where applicable.
5. Re-run exact-SHA release gates after any license, notice, or bundled-content change.

Do not replace the root `LICENSE` with Apache-2.0 or advertise Apache-2.0 unless the required rights to do so are evidenced. A model-free initial release removes the model-weight/provider licensing path; it does not remove the repository's own code-license obligations.

## Public support contact

A real support contact must be configured before launch. Never publish a fabricated email address or identity.

## Private security reporting

GitHub private vulnerability reporting/security-advisory capability must be enabled and tested before public launch.

## Search Console / analytics

External ownership verification, Search Console registration, sitemap submission, analytics provider configuration, and legal consent requirements must be completed in the relevant external accounts. Verify these actions with evidence; repository files alone are not proof.

## Distribution accounts

Product Hunt, Hacker News, Reddit, X, LinkedIn, YouTube, and email delivery require account-level actions. Repository automation can prepare content and runbooks but cannot treat those external actions as completed without evidence.
