import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const manual = read('src/config/manual-capability-definition.ts');
const registry = read('src/config/registry.ts');
const adapters = read('src/lib/tool-chain-adapters.ts');
const compatibility = read('src/lib/tool-chain-compatibility.ts');
const runner = read('src/lib/tool-chain-runner.ts');
const canonicalExecutor = read('src/lib/execution/canonical-executor.ts');
const outputContracts = read('src/lib/contracts/tool-output-contracts.ts');
const releaseSpec = read('tests/official/mvp-10-release-verification.spec.ts');

const idsMatch = manual.match(/MVP_EXECUTABLE_TOOL_IDS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\s*as const\)/);
if (!idsMatch) throw new Error('MVP_EXECUTABLE_TOOL_IDS_DECLARATION_MISSING');

const ids = [...idsMatch[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
const uniqueIds = [...new Set(ids)];

const expected = [
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

if (uniqueIds.length !== expected.length) {
  throw new Error('MVP_EXECUTABLE_TOOL_IDS_COUNT_INVALID: ' + uniqueIds.length);
}

const missingFromCanonicalList = expected.filter((id) => !uniqueIds.includes(id));
if (missingFromCanonicalList.length) {
  throw new Error('MVP_CANONICAL_ID_MISSING: ' + missingFromCanonicalList.join(', '));
}

if (!/executeCanonicalTool/.test(adapters)) throw new Error('CHAIN_ADAPTERS_NOT_CANONICAL');
if (/getVideoToolExecutor|videoToolExecutor|imageEngine|directEngine/i.test(adapters)) {
  throw new Error('CHAIN_ADAPTER_BYPASSES_CANONICAL_EXECUTOR');
}
if (!/executeCanonicalChain/.test(runner)) throw new Error('CHAIN_RUNNER_NOT_CANONICAL');
if (!/getToolById\(toolId\)/.test(canonicalExecutor)) throw new Error('CANONICAL_EXECUTOR_NOT_REGISTRY_BOUND');
if (!/getCapability\(toolId\)/.test(canonicalExecutor)) throw new Error('CANONICAL_EXECUTOR_NOT_CAPABILITY_BOUND');
if (!/tool\.operational\.executorId !== toolId/.test(canonicalExecutor)) throw new Error('CANONICAL_EXECUTOR_BINDING_GUARD_MISSING');
if (!/getToolOutputContract\(toolId\)/.test(canonicalExecutor)) throw new Error('CANONICAL_EXECUTOR_OUTPUT_CONTRACT_MISSING');
if (!/capability\.verifier\(/.test(canonicalExecutor)) throw new Error('CANONICAL_EXECUTOR_VERIFIER_MAPPING_MISSING');
if (!/export async function executeCanonicalTool/.test(canonicalExecutor)) throw new Error('CANONICAL_EXECUTOR_ENTRYPOINT_MISSING');
if (/export\s+(?:async\s+)?function\s+(?!executeCanonical(?:Tool|Chain)\b)execute\w+/i.test(canonicalExecutor)) {
  throw new Error('SECOND_EXECUTION_AUTHORITY_EXPORTED');
}
if (!/validateToolChainContracts/.test(compatibility)) throw new Error('CHAIN_CONTRACT_VALIDATOR_MISSING');
if (!/MVP_EXECUTABLE_TOOL_IDS\.includes\(toolId/.test(compatibility)) {
  throw new Error('CHAIN_COMPATIBILITY_NOT_BOUND_TO_CANONICAL_IDS');
}

for (const id of expected) {
  const quotedDefinition = new RegExp("['\"]" + id + "['\"]\\s*:");
  if (!quotedDefinition.test(outputContracts)) throw new Error('OUTPUT_CONTRACT_MISSING: ' + id);
  if (!registry.includes(id)) throw new Error('REGISTRY_ID_MISSING: ' + id);
  if (!releaseSpec.includes(id)) throw new Error('RELEASE_TEST_MAPPING_MISSING: ' + id);
  if (!manual.includes(id)) throw new Error('MANUAL_CAPABILITY_ID_MISSING: ' + id);
}

const manualExecutableCount = (manual.match(/state:\s*["']EXECUTABLE["']/g) || []).length;
const executorBindingCount = (manual.match(/executorId:/g) || []).length;
const outputBindingCount = (manual.match(/outputContractId:/g) || []).length;
const lifecycleReadyCount = (manual.match(/lifecycle:\s*["']ready["']/g) || []).length;

if (manualExecutableCount < expected.length) throw new Error('MANUAL_EXECUTABLE_DEFINITION_COUNT_TOO_LOW');
if (executorBindingCount < expected.length) throw new Error('EXECUTOR_BINDING_COUNT_TOO_LOW');
if (outputBindingCount < expected.length) throw new Error('OUTPUT_CONTRACT_BINDING_COUNT_TOO_LOW');
if (lifecycleReadyCount < expected.length) throw new Error('READY_LIFECYCLE_BINDING_COUNT_TOO_LOW');

console.log(JSON.stringify({
  status: 'PASS',
  executableToolCount: expected.length,
  canonicalExecutorBinding: true,
  registryParity: true,
  outputContractParity: true,
  verifierParity: true,
  lifecycleParity: true,
  canonicalExecutorSingleAuthority: true,
  releaseSpecParity: true,
}));
