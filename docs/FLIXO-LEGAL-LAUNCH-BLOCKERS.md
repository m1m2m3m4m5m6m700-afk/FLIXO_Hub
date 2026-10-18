# FLIXO Legal / External Launch Blockers

**Status:** `BLOCKED_WITH_EVIDENCE`

These items require rights-owner or external-account action and must not be represented as complete by repository automation.

## Repository code license: source-of-truth conflict

The root `LICENSE` file currently contains the GNU Affero General Public License, version 3 (AGPL-3.0) text. The product-owner instruction recorded during release governance selected Apache-2.0 as the intended target license. These two states do not match, so the former statement that “no repository code license has been selected” was inaccurate.

Do not advertise Apache-2.0 or replace the current license file until the rights to relicense all covered repository contributions, required copyright notices, and any applicable third-party notices have been verified. The current AGPL-3.0 file is evidence of the license text presently in the repository; it does not, by itself, prove that the requested Apache-2.0 transition has been legally cleared.

Required closure:
1. Review contribution and copyright provenance and record authority to relicense the covered code.
2. Confirm the final licensing decision and required copyright-holder/NOTICE wording with the rights owner.
3. If Apache-2.0 is authorized, update the root license and all product disclosures consistently, run license/security checks, and retain rights evidence. Otherwise retain AGPL-3.0 and ensure all distribution and network-use obligations and disclosures are met.
4. Re-run the exact-SHA release gates after any license or notice change.

A model-free initial release removes the model-weight/provider licensing path; it does not remove the repository's own code-license obligations.

## Public support contact

A real support contact must be configured before launch. Never publish a fabricated email address or identity.

## Private security reporting

GitHub private vulnerability reporting/security-advisory capability must be enabled and tested before public launch.

## Search Console / analytics

External ownership verification, Search Console registration, sitemap submission, analytics provider configuration, and legal consent requirements must be completed in the relevant external accounts. Verify these actions with evidence; repository files alone are not proof.

## Distribution accounts

Product Hunt, Hacker News, Reddit, X, LinkedIn, YouTube, and email delivery require account-level actions. Repository automation can prepare content and runbooks but cannot treat those external actions as completed without evidence.
