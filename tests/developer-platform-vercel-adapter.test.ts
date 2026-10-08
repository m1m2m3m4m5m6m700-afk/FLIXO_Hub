import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProviderResourceCompatibility,
  chooseExecutionProvider,
} from '../src/lib/developer-platform/execution-provider';
import {
  VercelSandboxExecutionProvider,
  type VercelSandboxClient,
} from '../src/lib/developer-platform/vercel-sandbox-adapter';
import { DEFAULT_PROGRAMMING_LIMITS, type PlatformExecutionRequest } from '../src/lib/developer-platform/platform-contract';

const SHA = '0123456789abcdef0123456789abcdef01234567';

const request = (): PlatformExecutionRequest => ({
  projectId: 'demo-project',
  taskId: 'EXEC-PLATFORM-EXECUTOR-001',
  agentId: 'platform-test',
  sessionId: 'session-vercel',
  startSha: SHA,
  sourceSha: SHA,
  command: 'node',
  args: ['-e', 'console.log("ok")'],
  cwd: '/workspace',
  environmentKeys: [],
  network: { mode: 'NONE' },
  limits: { ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 2048 },
  expectedArtifacts: ['stdout'],
  source: { type: 'git', url: 'https://github.com/example/repo.git', revision: SHA, depth: 1 },
});

test('Vercel Sandbox provider remains explicitly unconfigured without a client', () => {
  const provider = new VercelSandboxExecutionProvider(null);
  assert.equal(provider.getStatus().configured, false);
  assert.equal(provider.getStatus().blockedReason, 'VERCEL_SANDBOX_CLIENT_NOT_CONFIGURED');
});

test('Vercel Sandbox provider is discoverable only when configured', () => {
  const provider = new VercelSandboxExecutionProvider(null);
  assert.equal(chooseExecutionProvider({ providers: [provider] }), null);
  assert.equal(chooseExecutionProvider({ providers: [provider] }, 'vercel-sandbox'), provider);
});

test('provider rejects limits it cannot enforce exactly', () => {
  assert.throws(
    () => assertProviderResourceCompatibility({ ...DEFAULT_PROGRAMMING_LIMITS, memoryMb: 1024 }, {
      minMemoryMb: 2048,
      memoryStepMb: 2048,
      maxTimeoutMs: 5 * 60 * 60 * 1000,
    }),
    /UNSUPPORTED_RESOURCE_LIMITS/,
  );
});

test('fake sandbox proves exact source and cleanup behavior through the adapter', async () => {
  let stopped = false;
  let observed: { source?: unknown; command?: string; args?: readonly string[] } = {};
  const client: VercelSandboxClient = {
    async create(input) {
      observed = { source: input.source, command: undefined, args: undefined };
      return {
        async runCommand(input) {
          observed.command = input.cmd;
          observed.args = input.args;
          return {
            exitCode: 0,
            async stdout() { return 'ok'; },
            async stderr() { return ''; },
          };
        },
        async stop() {
          stopped = true;
        },
      };
    },
  };
  const provider = new VercelSandboxExecutionProvider(client);
  const result = await provider.execute(request());
  assert.equal(result.conclusion, 'PASS');
  assert.equal(result.sourceSha, SHA);
  assert.equal(result.artifacts.length, 1);
  assert.equal(observed.command, 'node');
  assert.deepEqual(observed.args, ['-e', 'console.log("ok")']);
  assert.deepEqual(observed.source, request().source);
  assert.equal(stopped, true);
});
