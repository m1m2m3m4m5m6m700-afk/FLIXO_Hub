import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { TOOL_REGISTRY } = await import('../src/config/registry.ts');
const { TOOL_CHAIN_ADAPTERS } = await import('../src/lib/tool-chain-adapters.ts');

const releaseTests = {
  'background-remover': 'tests/background-remover.contract.spec.ts',
  'image-upscaler': 'tests/image-upscaler.contract.spec.ts',
  'image-cropper': 'tests/image-cropper.contract.spec.ts',
  'image-compressor': 'tests/image-compressor.contract.spec.ts',
  'image-converter': 'tests/image-converter.contract.spec.ts',
  'image-effects': 'tests/image-effects.spec.ts',
  'video-trimmer': 'tests/official/video-capability-acceptance.spec.ts',
  'video-cropper': 'tests/official/video-capability-acceptance.spec.ts',
  'video-resizer': 'tests/official/video-capability-acceptance.spec.ts',
  'video-compressor': 'tests/official/video-capability-acceptance.spec.ts',
};
const failures = [];
const executable = TOOL_REGISTRY.filter((tool) => tool.capability.state === 'EXECUTABLE');
for (const tool of executable) {
  const adapter = TOOL_CHAIN_ADAPTERS[tool.id];
  if (!tool.operational.executorId) failures.push(`${tool.id}: executable capability has no executorId`);
  if (tool.operational.executorId !== tool.id) failures.push(`${tool.id}: executorId must remain canonical and equal to registry id`);
  if (!adapter || typeof adapter.execute !== 'function') failures.push(`${tool.id}: canonical tool-chain adapter is missing`);
  if (typeof tool.verifier !== 'function') failures.push(`${tool.id}: verifier is missing`);
  const testPath = releaseTests[tool.id];
  if (!testPath) failures.push(`${tool.id}: release test mapping is missing`);
  else {
    const absolute = resolve(testPath);
    if (!existsSync(absolute)) failures.push(`${tool.id}: release test file is missing: ${testPath}`);
    else if (!readFileSync(absolute, 'utf8').includes(tool.id)) failures.push(`${tool.id}: release test file does not name the capability id`);
  }
}
const mappedIds = Object.keys(releaseTests);
for (const id of mappedIds) if (!executable.some((tool) => tool.id === id)) failures.push(`${id}: release test is mapped but capability is not EXECUTABLE in canonical registry`);

if (failures.length) {
  console.error('[executable-capability-coverage] BLOCKED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log(`[executable-capability-coverage] PASS: ${executable.length} executable capabilities have canonical adapters, verifiers, and release tests`);