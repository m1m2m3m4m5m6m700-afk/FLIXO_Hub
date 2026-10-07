import {
  DEFAULT_CONFIG,
  Metrics,
  allowRate,
  authAdmin,
  authAgent,
  decide,
  heartbeatBody,
  loadConfig,
  readJson,
  stub,
  rpc,
  HttpError,
} from './lib/runtime';
import { AgentState } from './durable';
import type { Env } from './lib/types';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
});

const errorResponse = (error: unknown) => {
  if (error instanceof HttpError) return json({ error: error.code }, error.status);
  return json({ error: error instanceof Error ? error.message : 'INTERNAL_ERROR' }, 500);
};

const loadedFor = (env: Env) => {
  const loaded = loadConfig(env);
  if (!loaded) throw new HttpError(503, 'INVALID_WATCHDOG_CONFIG');
  return loaded;
};

const handleHeartbeat = async (request: Request, env: Env) => {
  const fingerprint = await authAgent(request, env, new Metrics());
  const loaded = loadedFor(env);
  const body = await readJson(request, loaded.config.maxBodyBytes);
  const heartbeat = heartbeatBody(
    body,
    loaded.config,
    loaded.agents,
    loaded.github?.repository,
    loaded.github?.allowedWorkflows ?? [],
  );
  if (!(await allowRate(env, fingerprint, heartbeat.agentId, 'heartbeat', loaded.config))) {
    return json({ error: 'RATE_LIMITED' }, 429);
  }
  const result = await rpc<{ consecutiveFails: number; breakerTripped: boolean }>(
    await stub(env, heartbeat.agentId),
    'recordHeartbeat',
    { heartbeat, failureLimit: loaded.config.maxConsecutiveFails },
    loaded.config.maxResponseBytes,
  );
  const metrics = new Metrics();
  if (heartbeat.status === 'running') metrics.inc('hb_running');
  if (heartbeat.status === 'completed') metrics.inc('hb_completed');
  if (heartbeat.status === 'failed') metrics.inc('hb_failed');
  return json({ ok: true, ...result });
};

const handleCheckpoint = async (request: Request, env: Env) => {
  const fingerprint = await authAgent(request, env, new Metrics());
  const loaded = loadedFor(env);
  const body = await readJson(request, loaded.config.maxBodyBytes);
  if (typeof body.agent_id !== 'string') throw new HttpError(422, 'INVALID_AGENT_ID');
  if (!(await allowRate(env, fingerprint, body.agent_id, 'mutation', loaded.config))) return json({ error: 'RATE_LIMITED' }, 429);
  return json(await rpc(
    await stub(env, body.agent_id),
    'setCheckpoint',
    { seq: body.seq, checkpoint: body.checkpoint },
    loaded.config.maxResponseBytes,
  ));
};

const handleMetrics = async (request: Request, env: Env) => {
  await authAdmin(request, env, new Metrics());
  const loaded = loadedFor(env);
  const metrics = new Metrics();
  await decide(env, metrics);
  const snapshots: Record<string, unknown> = {};
  for (const agent of loaded.agents.slice(0, loaded.config.maxStatusAgents)) {
    snapshots[agent] = await rpc(await stub(env, agent), 'getSnapshot', undefined, loaded.config.maxResponseBytes);
  }
  return json({ metrics: metrics.snapshot(), agents: snapshots });
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'flixo-agent-watchdog' });
      if (request.method === 'POST' && url.pathname === '/heartbeat') return await handleHeartbeat(request, env);
      if (request.method === 'POST' && url.pathname === '/checkpoint') return await handleCheckpoint(request, env);
      if (request.method === 'GET' && url.pathname === '/metrics') return await handleMetrics(request, env);
      if (request.method === 'POST' && url.pathname === '/decide') {
        await authAdmin(request, env, new Metrics());
        const metrics = new Metrics();
        await decide(env, metrics);
        return json(metrics.snapshot());
      }
      return json({ error: 'NOT_FOUND' }, 404);
    } catch (error) {
      return errorResponse(error);
    }
  },
};

export { AgentState };
export default worker;
