// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('LICENSE contains the Apache License 2.0 terms', () => {
  const license = readFileSync('LICENSE', 'utf8');
  assert.match(license, /^Apache License\s+Version 2\.0, January 2004/m);
  assert.match(license, /2\. Grant of Copyright License/);
  assert.match(license, /3\. Grant of Patent License/);
  assert.match(license, /9\. Accepting Warranty or Additional Liability/);
  assert.match(license, /END OF TERMS AND CONDITIONS/);
});

test('REUSE Apache license text is byte-identical to LICENSE', () => {
  assert.deepEqual(
    readFileSync('LICENSES/Apache-2.0.txt'),
    readFileSync('LICENSE'),
  );
});

test('repository license metadata consistently identifies Apache-2.0', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const citation = readFileSync('CITATION.cff', 'utf8');
  const reuse = readFileSync('REUSE.toml', 'utf8');
  assert.equal(pkg.license, 'Apache-2.0');
  assert.match(citation, /^license: ["']Apache-2\.0["']/m);
  assert.match(reuse, /SPDX-License-Identifier = "Apache-2\.0"/);
});
