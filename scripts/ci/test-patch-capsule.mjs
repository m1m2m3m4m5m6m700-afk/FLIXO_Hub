import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { capture, verify, reconcile } from './patch-capsule.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const initRepo = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flixo-capsule-'));
  git(dir, 'init');
  git(dir, 'config', 'user.email', 'test@example.invalid');
  git(dir, 'config', 'user.name', 'FLIXO Test');
  await writeFile(join(dir, 'file.txt'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'base');
  return dir;
};

test('captures an exact candidate patch and rejects wrong parent', async () => {
  const dir = await initRepo();
  try {
    const source = git(dir, 'rev-parse', 'HEAD');
    await writeFile(join(dir, 'file.txt'), 'base\nagent change\n');
    git(dir, 'commit', '-am', 'candidate');
    const candidate = git(dir, 'rev-parse', 'HEAD');
    const capsule = capture({ sourceSha: source, candidateSha: candidate, cwd: dir, taskId: 't-1' });
    verify(capsule);
    assert.equal(capsule.parentSha, source);
    assert.equal(capsule.candidateSha, candidate);
    assert.equal(capsule.paths.length, 1);
    assert.match(capsule.patchText, /agent change/);
    await writeFile(join(dir, 'file.txt'), 'base\nsecond change\n');
    git(dir, 'commit', '-am', 'second candidate');
    const secondCandidate = git(dir, 'rev-parse', 'HEAD');
    await assert.rejects(
      async () => capture({ sourceSha: candidate, candidateSha: secondCandidate, cwd: dir }),
      /PATCH_CAPSULE_PARENT_MISMATCH/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('reconciles a patch onto a moved execution head with three-way merge', async () => {
  const dir = await initRepo();
  try {
    const source = git(dir, 'rev-parse', 'HEAD');
    await writeFile(join(dir, 'file.txt'), 'base\nagent change\n');
    git(dir, 'commit', '-am', 'agent candidate');
    const candidate = git(dir, 'rev-parse', 'HEAD');
    const capsule = capture({ sourceSha: source, candidateSha: candidate, cwd: dir });

    // Move HEAD with a non-overlapping change, simulating another agent.
    git(dir, 'reset', '--hard', source);
    await writeFile(join(dir, 'other.txt'), 'parallel work\n');
    git(dir, 'add', 'other.txt');
    git(dir, 'commit', '-m', 'parallel head');
    const movedHead = git(dir, 'rev-parse', 'HEAD');

    const result = reconcile({ capsule, targetSha: movedHead, cwd: dir });
    assert.equal(result.targetSha, movedHead);
    assert.equal(result.parentSha, movedHead);
    assert.equal(result.status, 'RECONCILED');
    assert.match(result.patchText, /agent change/);
    assert.match(result.patchText, /file.txt/);
    assert.equal(result.paths.includes('file.txt'), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fails closed on an overlapping change and preserves the capsule', async () => {
  const dir = await initRepo();
  try {
    const source = git(dir, 'rev-parse', 'HEAD');
    await writeFile(join(dir, 'file.txt'), 'base\nagent change\n');
    git(dir, 'commit', '-am', 'agent candidate');
    const candidate = git(dir, 'rev-parse', 'HEAD');
    const capsule = capture({ sourceSha: source, candidateSha: candidate, cwd: dir });

    git(dir, 'reset', '--hard', source);
    await writeFile(join(dir, 'file.txt'), 'base\nconflicting change\n');
    git(dir, 'commit', '-am', 'parallel conflicting change');
    const movedHead = git(dir, 'rev-parse', 'HEAD');

    await assert.rejects(
      () => reconcile({ capsule, targetSha: movedHead, cwd: dir }),
      /PATCH_CAPSULE_CONFLICT/,
    );
    verify(capsule);
    assert.equal(capsule.sourceSha, source);
    assert.match(capsule.patchText, /agent change/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});


test('reconciles a newly created file without dropping the addition', async () => {
  const dir = await initRepo();
  try {
    const source = git(dir, 'rev-parse', 'HEAD');
    await writeFile(join(dir, 'new-file.txt'), 'agent-created file\n');
    git(dir, 'add', 'new-file.txt');
    git(dir, 'commit', '-m', 'agent adds file');
    const candidate = git(dir, 'rev-parse', 'HEAD');
    const capsule = capture({ sourceSha: source, candidateSha: candidate, cwd: dir });

    git(dir, 'reset', '--hard', source);
    await writeFile(join(dir, 'parallel.txt'), 'parallel work\n');
    git(dir, 'add', 'parallel.txt');
    git(dir, 'commit', '-m', 'parallel head');
    const movedHead = git(dir, 'rev-parse', 'HEAD');

    const result = reconcile({ capsule, targetSha: movedHead, cwd: dir });
    assert.equal(result.status, 'RECONCILED');
    assert.match(result.patchText, /new-file\.txt/);
    assert.match(result.patchText, /agent-created file/);
    assert.equal(result.paths.includes('new-file.txt'), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
