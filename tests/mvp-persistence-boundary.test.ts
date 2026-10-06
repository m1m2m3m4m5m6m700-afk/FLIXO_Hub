import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const activeMvpPaths = [
  'src/routes/agent.tsx',
  'src/tools/background-remover/index.tsx',
  'src/tools/image-upscaler/index.tsx',
  'src/tools/image-cropper/index.tsx',
  'src/tools/image-compressor/index.tsx',
  'src/tools/image-converter/index.tsx',
  'src/tools/image-effects/index.tsx',
  'src/tools/video-local/index.tsx',
  'src/lib/agent-guided-runtime.ts',
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
  assert.match(scope, /userFileBytesMayCrossNetwork\\s*:\\s*false/u);
  assert.match(scope, /backendRequiredForFileExecution\\s*:\\s*false/u);
  assert.match(scope, /executionLocation\\s*:\\s*['"]BROWSER_ONLY['"]/u);
});
