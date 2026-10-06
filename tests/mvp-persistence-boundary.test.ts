import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

test('manual-only production has no public or internal Agent execution surface', () => {
  assert.equal(existsSync(resolve(root, 'src/routes/agent.tsx')), false);
  assert.equal(existsSync(resolve(root, 'src/lib/agent-guided-runtime.ts')), false);
});

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const activeMvpPaths = [
  'src/tools/background-remover/index.tsx',
  'src/tools/image-upscaler/index.tsx',
  'src/tools/image-cropper/index.tsx',
  'src/tools/image-compressor/index.tsx',
  'src/tools/image-converter/index.tsx',
  'src/tools/image-effects/index.tsx',
  'src/tools/video-local/index.tsx',
  'src/lib/execution/canonical-executor.ts',
  'src/config/registry.ts',
  'src/config/manual-capability-definition.ts',
];

test('current MVP file-editing path is persistence independent', () => {
  for (const path of activeMvpPaths) {
    const text = readFileSync(resolve(root, path), 'utf8');
    assert.doesNotMatch(text, /(?:@supabase|supabase-js|createClient|createBrowserClient|supabaseUrl|supabaseKey)/iu, path);
  }
});

test('MVP scope contract explicitly requires browser-local file execution without backend file processing', () => {
  const scope = readFileSync(resolve(root, 'src/lib/contracts/mvp-scope.ts'), 'utf8');
  assert.match(scope, /userFileBytesMayCrossNetwork\s*:\s*false/u);
  assert.match(scope, /backendRequiredForFileExecution\s*:\s*false/u);
  assert.match(scope, /executionLocation\s*:\s*['"]BROWSER_ONLY['"]/u);
});
