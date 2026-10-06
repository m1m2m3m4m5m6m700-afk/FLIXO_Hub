#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const SHA = /^[a-f0-9]{40}$/u;
const REQUIRED_REGIONS = ['europe', 'north-america', 'middle-east', 'asia-pacific'];

export function validateBaselineManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest:missing'] };

  if (manifest.repository !== 'm1m2m3m4m5m6m700-afk/FLIXO_Hub') {
    errors.push('repository:not-canonical');
  }
  if (!SHA.test(String(manifest.executionSha ?? ''))) errors.push('executionSha:invalid');
  if (typeof manifest.measuredAtUtc !== 'string' || Number.isNaN(Date.parse(manifest.measuredAtUtc))) {
    errors.push('measuredAtUtc:invalid');
  }
  if (manifest.methodologyVersion !== 'global-baseline-v1') errors.push('methodologyVersion:unexpected');

  const regions = Array.isArray(manifest.regions) ? manifest.regions : [];
  const ids = new Set(regions.map((region) => region?.id));
  for (const region of REQUIRED_REGIONS) if (!ids.has(region)) errors.push('region:missing:' + region);

  for (const region of regions) {
    if (!REQUIRED_REGIONS.includes(region?.id)) continue;
    for (const key of ['probeCount', 'p50Ms', 'p95Ms', 'errorRate']) {
      const value = region?.[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        errors.push(region.id + ':' + key + ':invalid');
      }
    }
    if (typeof region?.fileBytesUploaded !== 'boolean') errors.push(region.id + ':fileBytesUploaded:missing');
    if (region?.fileBytesUploaded !== false) errors.push(region.id + ':fileBytesUploaded:true');
    if (typeof region?.thirdPartyUploadRoutes !== 'number' || region.thirdPartyUploadRoutes !== 0) {
      errors.push(region.id + ':thirdPartyUploadRoutes:nonzero');
    }
  }

  const privacy = manifest.privacyEvidence;
  if (privacy?.fileBytesUploaded !== false) errors.push('privacy:fileBytesUploaded:not-false');
  if (privacy?.thirdPartyUploadRoutes !== 0) errors.push('privacy:thirdPartyUploadRoutes:not-zero');
  if (privacy?.consentBehaviorVerified !== true) errors.push('privacy:consentBehaviorVerified:not-true');

  const accessibility = manifest.accessibilityEvidence;
  if (accessibility?.wcagVersion !== '2.2') errors.push('accessibility:wcagVersion');
  if (accessibility?.targetLevel !== 'AA') errors.push('accessibility:targetLevel');
  if (accessibility?.automatedChecksPass !== true) errors.push('accessibility:automatedChecksPass');
  if (accessibility?.manualReviewRecorded !== true) errors.push('accessibility:manualReviewRecorded');

  const localization = manifest.localizationEvidence;
  if (typeof localization?.canonicalLocaleCount !== 'number' || localization.canonicalLocaleCount < 4) {
    errors.push('localization:canonicalLocaleCount');
  }
  if (localization?.rtlLocalePresent !== true) errors.push('localization:rtlLocalePresent');
  if (localization?.hreflangVerified !== true) errors.push('localization:hreflangVerified');
  if (localization?.localizedMetadataVerified !== true) errors.push('localization:localizedMetadataVerified');

  return { ok: errors.length === 0, errors };
}

function main() {
  const path = process.argv[2];
  if (!path) throw new Error('FAIL_CLOSED: manifest path is required.');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const result = validateBaselineManifest(manifest);
  if (!result.ok) {
    console.error('GLOBAL_BASELINE=FAIL');
    for (const error of result.errors) console.error(error);
    process.exit(1);
  }
  console.log('GLOBAL_BASELINE=PASS');
  console.log('REGIONS=' + REQUIRED_REGIONS.join(','));
  console.log('EXECUTION_SHA=' + manifest.executionSha);
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\', '/'))) main();
