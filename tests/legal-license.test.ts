// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('LICENSE contains the Apache License 2.0 terms', () => {
  const license = readFileSync('LICENSE', 'utf8');
  assert.match(license, /^Apache License\\s+Version 2\\.0, January 2004/m);
  assert.match(license, /2\\. Grant of Copyright License/);
  assert.match(license, /3\\. Grant of Patent License/);
  assert.match(license, /9\\. Accepting Warranty or Additional Liability/);
  assert.match(license, /END OF TERMS AND CONDITIONS/);
});

test('REUSE Apache license text is byte-identical to LICENSE', () => {
  assert.deepEqual(
    readFileSync('LICENSES/Apache-2.0.txt'),
    readFileSync('LICENSE'),
  );
});

test('repository package and citation metadata identify the selected license', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const citation = readFileSync('CITATION.cff', 'utf8');
  assert.equal(pkg.license, 'Apache-2.0');
  assert.match(citation, /^license: ["']Apache-2\\.0["']/m);
});

test('REUSE annotations do not blanket-assert Apache ownership for every file', () => {
  const reuse = readFileSync('REUSE.toml', 'utf8');
  assert.doesNotMatch(reuse, /path = "\\*\\*"[\\s\\S]*?SPDX-License-Identifier = "Apache-2\\.0"/);
  assert.match(reuse, /path = "LICENSES\\/AGPL-3\\.0-only\\.txt"[\\s\\S]*?SPDX-License-Identifier = "AGPL-3\\.0-only"/);
  assert.match(reuse, /path = "LICENSES\\/Apache-2\\.0\\.txt"[\\s\\S]*?SPDX-License-Identifier = "Apache-2\\.0"/);
});
