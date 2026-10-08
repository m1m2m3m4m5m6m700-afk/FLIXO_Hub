import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLocalProjectFile,
  isEditableTextFile,
  normalizeProjectPath,
} from '../src/lib/developer-platform/local-project-workspace.ts';

test('local project paths reject traversal and normalize separators', () => {
  assert.equal(normalizeProjectPath('./src\\index.ts'), 'src/index.ts');
  assert.throws(() => normalizeProjectPath('../secret.txt'), /INVALID_PROJECT_PATH/);
  assert.throws(() => normalizeProjectPath('/absolute/path.ts'), /INVALID_PROJECT_PATH/);
});

test('local workspace marks common source files editable and binaries non-editable', () => {
  assert.equal(isEditableTextFile(new File(['const x = 1;'], 'index.ts')), true);
  assert.equal(isEditableTextFile(new File([new Uint8Array([0, 1, 2])], 'image.png')), false);
});

test('new local files stay in memory and begin dirty', () => {
  const file = createLocalProjectFile('src/hello.ts', 'export const hello = true;');
  assert.equal(file.file, null);
  assert.equal(file.dirty, true);
  assert.equal(file.text, 'export const hello = true;');
});
