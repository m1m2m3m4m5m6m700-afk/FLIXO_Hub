import assert from 'node:assert/strict';
import test from 'node:test';
import { createVercelSandboxClient } from '../src/lib/developer-platform/vercel-sandbox-client-factory';

test('client factory adapts an injected SDK without owning provider credentials', async () => {
  let created = false;
  const sdk = {
    Sandbox: {
      async create() {
        created = true;
        return {
          async runCommand() {
            return { exitCode: 0, async stdout() { return 'ok'; }, async stderr() { return ''; } };
          },
          async stop() {},
        };
      },
    },
  };
  const client = createVercelSandboxClient(sdk);
  await client.create({
    name: 'adapter-test',
    persistent: false,
    timeout: 1000,
    networkPolicy: { mode: 'deny-all' },
    resources: { vcpus: 1, memory: 2048 },
    source: { type: 'git', url: 'https://github.com/example/repo.git', revision: '0123456789abcdef0123456789abcdef01234567', depth: 1 },
  });
  assert.equal(created, true);
});