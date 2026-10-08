import type { VercelSandboxClient, VercelSandboxCommandResult, VercelSandboxSession } from './vercel-sandbox-adapter';
import type { PlatformExecutionRequest } from './platform-contract';

type VercelSdkSandbox = {
  runCommand(input: { cmd: string; args: readonly string[]; cwd: string; timeout: number }): Promise<VercelSandboxCommandResult>;
  stop(): Promise<unknown>;
};

export type VercelSandboxSdkModule = Readonly<{
  Sandbox: Readonly<{
    create(input: {
      name: string;
      persistent: false;
      timeout: number;
      networkPolicy: PlatformExecutionRequest['network'] | Readonly<{ mode: 'deny-all' | 'custom'; allowedDomains?: readonly string[] }>;
      resources: Readonly<{ vcpus: number; memory: number }>;
      source: NonNullable<PlatformExecutionRequest['source']>;
    }): Promise<VercelSdkSandbox>;
  }>;
}>;

export function createVercelSandboxClient(sdk: VercelSandboxSdkModule): VercelSandboxClient {
  return {
    async create(input) {
      const sandbox = await sdk.Sandbox.create(input);
      return sandbox as VercelSandboxSession;
    },
  };
}