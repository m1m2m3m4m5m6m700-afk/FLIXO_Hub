import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const contracts = {
  'src/tools/image-toolkit/engine.ts': [/URL\.revokeObjectURL\(/u,/canvas\.width\s*=\s*0/u,/canvas\.height\s*=\s*0/u],
  'src/tools/_shared/image-effects-worker.ts': [/image\.close\(\)/u,/canvas\.width\s*=\s*0/u,/canvas\.height\s*=\s*0/u],
  'src/tools/image-compressor/compressor.worker.ts': [/canvas\.width\s*=\s*0/u,/canvas\.height\s*=\s*0/u],
  'src/lib/video/video-executor.ts': [/URL\.revokeObjectURL\(/u,/getTracks\(\)/u,/cancelAnimationFrame\(/u,/canvas\.width\s*=\s*0/u],
};
for (const [path, patterns] of Object.entries(contracts)) {
  test(path + ' satisfies resource lifecycle contract', () => {
    const content = readFileSync(resolve(path), 'utf8');
    for (const pattern of patterns) assert.match(content, pattern);
  });
}
