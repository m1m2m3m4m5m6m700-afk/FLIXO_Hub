import test from 'node:test';
import assert from 'node:assert/strict';

import { executeCanonicalChain, executeCanonicalTool } from '../src/lib/execution/canonical-executor.ts';
import { MVP_EXECUTABLE_TOOL_IDS } from '../src/config/manual-capability-definition.ts';

test('every current MVP capability resolves through the canonical executor boundary', async () => {
  assert.equal(MVP_EXECUTABLE_TOOL_IDS.length, 10);
  for (const toolId of MVP_EXECUTABLE_TOOL_IDS) {
    const isVideo = toolId.startsWith('video-');
    const file = isVideo
      ? new File(['not-a-real-video'], 'fixture.webm', { type: 'video/webm' })
      : new File(['not-a-real-image'], 'fixture.png', { type: 'image/png' });
    await assert.rejects(
      () => executeCanonicalTool(toolId, { blob: file, fileName: file.name }, {}),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        return !/no canonical executor is registered|executor is registered/i.test(message);
      },
      toolId,
    );
  }
});

test('canonical executor rejects unknown and non-executable capabilities before processing', async () => {
  const file = new File(['x'], 'fixture.png', { type: 'image/png' });
  await assert.rejects(
    () => executeCanonicalTool('not-a-tool', { blob: file, fileName: file.name }),
    /unknown tool/i,
  );
  await assert.rejects(
    () => executeCanonicalTool('object-remover', { blob: file, fileName: file.name }),
    /not executable|release-ready/i,
  );
});

test('canonical chain is bounded and fail-closed', async () => {
  const file = new File(['x'], 'fixture.png', { type: 'image/png' });
  await assert.rejects(
    () => executeCanonicalChain([], { blob: file, fileName: file.name }),
    /between 1 and 4/i,
  );
  await assert.rejects(
    () => executeCanonicalChain(Array.from({ length: 5 }, () => ({ toolId: 'image-converter' })), { blob: file, fileName: file.name }),
    /between 1 and 4/i,
  );
});
