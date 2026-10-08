import { evaluatePlatformExecution, type PlatformExecutionRequest } from './platform-contract';
import { chooseExecutionProvider, type ExecutionProvider, type ExecutionResult } from './execution-provider';

export type PlatformExecutionOutcome =
  | Readonly<{ status: 'ADMITTED'; providerId: string; result: ExecutionResult }>
  | Readonly<{ status: 'BLOCKED'; code: string }>;

export async function executePlatformRequest(input: Readonly<{
  request: PlatformExecutionRequest;
  currentSha: string;
  providers: readonly ExecutionProvider[];
  providerId?: string;
}>): Promise<PlatformExecutionOutcome> {
  const decision = evaluatePlatformExecution(input.request, input.currentSha);
  if (!decision.admitted) return { status: 'BLOCKED', code: decision.code };

  const provider = chooseExecutionProvider({ providers: input.providers }, input.providerId);
  if (!provider) return { status: 'BLOCKED', code: 'NO_CONFIGURED_EXECUTION_PROVIDER' };
  if (!provider.getStatus().configured) return { status: 'BLOCKED', code: provider.getStatus().blockedReason ?? 'EXECUTION_PROVIDER_NOT_CONFIGURED' };

  const result = await provider.execute(input.request);
  if (result.sourceSha !== input.currentSha) return { status: 'BLOCKED', code: 'EXECUTION_RESULT_SHA_DRIFT' };
  return { status: 'ADMITTED', providerId: provider.id, result };
}