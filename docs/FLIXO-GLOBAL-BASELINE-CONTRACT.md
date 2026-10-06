# FLIXO Global Baseline Contract

STATUS: IMPLEMENTED-CONTRACT
AUTHORITY: `المهام.md`
SOURCE: G1 Global Baseline

## Required manifest identity

A baseline manifest must contain:
- repository;
- executionSha;
- measuredAtUtc;
- methodologyVersion;
- regions;
- privacyEvidence;
- accessibilityEvidence;
- localizationEvidence.

## Regional evidence

The minimum region set is:
- europe;
- north-america;
- middle-east;
- asia-pacific.

Each region must contain:
- probeCount;
- p50Ms;
- p95Ms;
- errorRate.

All numeric measurements must be finite and non-negative.

## Browser-local privacy boundary

The manifest must explicitly prove:
- fileBytesUploaded = false;
- thirdPartyUploadRoutes = 0;
- consentBehaviorVerified = true.

The verifier rejects missing values.

## Accessibility

The baseline records:
- wcagVersion = 2.2;
- targetLevel = AA;
- automatedChecksPass = true;
- manualReviewRecorded = true.

## Localization

The baseline records:
- canonicalLocaleCount >= 4;
- rtlLocalePresent = true;
- hreflangVerified = true;
- localizedMetadataVerified = true.

The contract is a measurement boundary, not a claim that the measurements have already been collected.
