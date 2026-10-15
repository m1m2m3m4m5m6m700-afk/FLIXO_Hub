import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildManifest } from '../../../scripts/build-model-artifact-manifest.mjs';

test('model artifact manifest is deterministic and covers every file', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'flixo-model-manifest-'));
  try {
    const input = path.join(temp, 'model');
    await mkdir(path.join(input, 'nested'), { recursive: true });
    await writeFile(path.join(input, 'config.json'), '{"model_type":"test"}');
    await writeFile(path.join(input, 'nested', 'weights.bin'), Buffer.from([0, 1, 2, 255]));

    const first = await buildManifest(input);
    const second = await buildManifest(input);
    assert.deepEqual(first, second);
    assert.equal(first.file_count, 2);
    assert.deepEqual(first.files.map((file) => file.path), ['config.json', 'nested/weights.bin']);
    assert.match(first.artifact_sha256, /^[a-f0-9]{64}$/u);
    assert.equal(first.total_size_bytes, Buffer.byteLength('{"model_type":"test"}') + 4);

    await writeFile(path.join(input, 'nested', 'weights.bin'), Buffer.from([0, 1, 2, 254]));
    const changed = await buildManifest(input);
    assert.notEqual(changed.artifact_sha256, first.artifact_sha256);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('model artifact manifest rejects empty directories and symbolic links', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'flixo-model-manifest-'));
  try {
    const empty = path.join(temp, 'empty');
    await mkdir(empty);
    await assert.rejects(buildManifest(empty), /empty/u);

    const input = path.join(temp, 'linked');
    await mkdir(input);
    const target = path.join(temp, 'target.txt');
    await writeFile(target, 'external');
    await symlink(target, path.join(input, 'target.txt'));
    await assert.rejects(buildManifest(input), /symbolic links are not allowed/u);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
