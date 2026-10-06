import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const registry = readFileSync(resolve('src/config/registry.ts'), 'utf8');
const canonical = readFileSync(resolve('src/config/canonical-tool-definition.ts'), 'utf8');
const manual = readFileSync(resolve('src/config/manual-capability-definition.ts'), 'utf8');
const imageAdapters = readFileSync(resolve('src/lib/tool-chain-adapters.ts'), 'utf8');
const videoAdapters = readFileSync(resolve('src/lib/video/video-tool-executors.ts'), 'utf8');
const contracts = readFileSync(resolve('src/lib/contracts/tool-output-contracts.ts'), 'utf8');
const scope = readFileSync(resolve('src/lib/contracts/mvp-scope.ts'), 'utf8');

const executableIds = [
  'background-remover',
  'image-upscaler',
  'image-cropper',
  'image-compressor',
  'image-converter',
  'image-effects',
  'video-trimmer',
  'video-cropper',
  'video-resizer',
  'video-compressor',
];
const releaseTests = new Map([
  ['background-remover', 'tests/background-remover.spec.ts'],
  ['image-upscaler', 'tests/image-upscaler.spec.ts'],
  ['image-cropper', 'tests/image-cropper.spec.ts'],
  ['image-compressor', 'tests/image-compressor.spec.ts'],
  ['image-converter', 'tests/image-converter.spec.ts'],
  ['image-effects', 'tests/image-effects.spec.ts'],
  ['video-trimmer', 'tests/official/video-capability-acceptance.spec.ts'],
  ['video-cropper', 'tests/official/video-capability-acceptance.spec.ts'],
  ['video-resizer', 'tests/official/video-capability-acceptance.spec.ts'],
  ['video-compressor', 'tests/official/video-capability-acceptance.spec.ts'],
]);

const failures = [];
if (!registry.includes('export const TOOL_REGISTRY')) failures.push('canonical TOOL_REGISTRY export is missing');
if (registry.includes('export const TOOLS_REGISTRY')) failures.push('second executable registry authority is present in registry.ts');
if (!canonical.includes('getCanonicalCapabilityDefinition(tool.id)')) failures.push('canonical tool definition does not consume the canonical capability definition');
if (!manual.includes('CAPABILITY_DEFINITIONS')) failures.push('canonical capability definitions are missing');

for (const id of executableIds) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`['"]${escaped}['"]`, 'u');
  if (!re.test(manual)) failures.push(`${id}: executable capability is not present in canonical manual capability definitions`);
  if (!new RegExp(`['"]${escaped}['"]`, 'u').test(imageAdapters) && !new RegExp(`['"]${escaped}['"]`, 'u').test(videoAdapters)) failures.push(`${id}: no executable adapter entry`);
  if (!new RegExp(`['"]${escaped}['"]\\s*:\\s*[^,]+`, 'u').test(contracts)) failures.push(`${id}: no output contract entry`);
  const verifierBinding = id === 'background-remover' ? 'backgroundRemovalVerifier' : id === 'image-upscaler' ? 'upscalerVerifier' : id === 'image-cropper' ? 'cropperVerifier' : id === 'image-compressor' ? 'targetSizeVerifier' : id === 'image-converter' ? 'formatVerifier' : id === 'image-effects' ? 'effectsVerifier' : 'videoVerifier';
  if (!manual.includes(`id===\"${id}\"?${verifierBinding}`) && !manual.includes(`id === \"${id}\" ? ${verifierBinding}`) && !manual.includes(`id==\"${id}\"?${verifierBinding}`)) failures.push(`${id}: canonical verifier binding is not explicit`);
  const testPath = releaseTests.get(id);
  if (!testPath || !existsSync(resolve(testPath))) failures.push(`${id}: release test file is missing`);
  else if (!readFileSync(resolve(testPath), 'utf8').includes(id)) failures.push(`${id}: release test file does not name the capability`);
}

if (scope.includes('recognized') && !scope.includes('RECOGNIZED')) failures.push('capability state casing/contract drift detected');

if (failures.length) {
  console.error('[registry-adapter-consistency] BLOCKED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('[registry-adapter-consistency] PASS: every executable capability has canonical registry, adapter, verifier, output contract, and release test evidence');