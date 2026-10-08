import {
  evaluatePlatformExecution,
  type PlatformExecutionAuthorityContext,
  type PlatformExecutionRequest,
} from './platform-contract';
import { chooseExecutionProvider, type ExecutionProvider, type ExecutionResult } from './execution-provider';

export type PlatformExecutionOutcome =
  | Readonly<{ status: 'ADMITTED'; providerId: string; result: ExecutionResult }>
  | Readonly<{ status: 'BLOCKED'; code: string }>;

export async function executePlatformRequest(input: Readonly<{
  request: PlatformExecutionRequest;
  currentSha: string;
  authority: PlatformExecutionAuthorityContext;
  providers: readonly ExecutionProvider[];
  providerId?: string;
}>): Promise<PlatformExecutionOutcome> {
  const decision = evaluatePlatformExecution(input.request, input.currentSha, input.authority);
  if (!decision.admitted) return { status: 'BLOCKED', code: decision.code };
  const provider = chooseExecutionProvider({ providers: input.providers }, input.providerId);
  if (!provider) return { status: 'BLOCKED', code: 'NO_CONFIGURED_EXECUTION_PROVIDER' };
  const status = provider.getStatus();
  if (!status.configured) return { status: 'BLOCKED', code: status.blockedReason ?? 'EXECUTION_PROVIDER_NOT_CONFIGURED' };
  const result = await provider.execute(input.request, input.authority);
  if (result.sourceSha !== input.currentSha) return { status: 'BLOCKED', code: 'EXECUTION_RESULT_SHA_DRIFT' };
  return { status: 'ADMITTED', providerId: provider.id, result };
}
