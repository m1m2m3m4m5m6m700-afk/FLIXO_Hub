#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const SHA_RE = /^[0-9a-f]{40}$/i;
export const MAX_MEMORY_RESULTS = 50;
export const MEMORY_STATUSES = Object.freeze([
  'CANDIDATE', 'VALIDATED', 'PROMOTED', 'DISPUTED', 'STALE_EVIDENCE', 'REVOKED', 'SUPERSEDED',
]);

export function preflightMemoryRetrieval({ currentSha, memories = [] } = {}) {
  const current = assertExactSha(currentSha, 'currentSha');
  if (!Array.isArray(memories)) throw new Error('memory retrieval result must be an array');
  const classified = memories.map(memory => classifyKnowledgeForSha(memory, current));
  const executable = classified.filter(memory => memory.usable === true);
  const warnings = classified.filter(memory => memory.usable !== true).map(memory => ({
    ...memory,
    retrieval_blocked: true,
    warning: memory.sha_freshness === 'STALE_EVIDENCE'
      ? 'stale evidence; excluded from execution context'
      : 'memory is not PROMOTED; excluded from execution context',
  }));
  return {
    currentSha: current,
    retrievalCount: classified.length,
    executableMemory: executable,
    warnings,
    blockedCount: warnings.length,
  };
}

export function createCognitiveMemoryAdapter(env = process.env) {
  return Object.freeze({
    preflight(currentSha, memories = []) {
      return preflightMemoryRetrieval({ currentSha, memories });
    },
    retrieve({ query, currentSha, limit = 8 } = {}) {
      return searchSharedMemoryForContext({ query, currentSha, limit }, env);
    },
    episodic({ taskId, currentSha, limit = 10 } = {}) {
      return searchEpisodicExperiences({ taskId, currentSha, limit }, env);
    },
    propose(payload) {
      return submitMemoryProposal(payload, env);
    },
    review(payload) {
      return reviewMemory(payload, env);
    },
    usage(payload) {
      return recordMemoryUsage(payload, env);
    },
    reconcile(payload) {
      return reconcileMemory(payload, env);
    },
  });
}

export async function searchSharedMemoryForContext({ query, currentSha, limit = 8 } = {}, env = process.env) {
  assertExactSha(currentSha, 'currentSha');
  const text = String(query ?? '').trim();
  if (!text) {
    const rows = await searchSharedMemory({ query: '', currentSha, limit, includeCandidates: true }, env);
    if (!Array.isArray(rows)) throw new Error('MEMORY_RETRIEVAL_INVALID_RESPONSE');
    return { ...preflightMemoryRetrieval({ currentSha, memories: rows }), semanticUsed: false };
  }

  const hasSupabase = Boolean(
    (env.SUPABASE_URL || env.SUPABASE_PROJECT_URL) &&
    (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY),
  );

  if (hasSupabase && env.SUPABASE_MEMORY_SEMANTIC !== 'false') {
    try {
      const embedding = await createMemoryEmbedding(text, env);
      const rows = await searchSharedMemorySemantic({
        query,
        currentSha,
        limit,
        includeCandidates: true,
        embedding,
      }, env);
      if (!Array.isArray(rows)) throw new Error('MEMORY_SEMANTIC_INVALID_RESPONSE');
      return { ...preflightMemoryRetrieval({ currentSha, memories: rows }), semanticUsed: true };
    } catch (error) {
      if (env.SUPABASE_MEMORY_SEMANTIC_STRICT === 'true') throw error;
    }
  }

  const rows = await searchSharedMemory({ query, currentSha, limit, includeCandidates: true }, env);
  if (!Array.isArray(rows)) throw new Error('MEMORY_RETRIEVAL_INVALID_RESPONSE');
  return { ...preflightMemoryRetrieval({ currentSha, memories: rows }), semanticUsed: false };
}

export function assertExactSha(value, field = 'sha') {
  if (!SHA_RE.test(value ?? '')) throw new Error(field + ' must be an exact 40-character git SHA');
  return String(value).toLowerCase();
}


function parseSupabaseResponse(response, label) {
  return response.text().then((raw) => {
    let parsed;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
    if (!response.ok) {
      const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      throw new Error(label + '_FAILED:' + response.status + ':' + detail);
    }
    return parsed;
  });
}

export async function createMemoryEmbedding(text, env = process.env, fetchImpl = globalThis.fetch) {
  const baseUrl = String(env.SUPABASE_URL || env.SUPABASE_PROJECT_URL || '').replace(/\/+$/,'');
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!nonEmptyString(baseUrl)) throw new Error('SUPABASE_URL_REQUIRED');
  if (!nonEmptyString(secret)) throw new Error('SUPABASE_SERVICE_KEY_REQUIRED');
  const functionName = String(env.SUPABASE_MEMORY_EMBED_FUNCTION || 'flixo-memory-embed');
  if (!/^[A-Za-z0-9_-]+$/.test(functionName)) throw new Error('MEMORY_EMBED_FUNCTION_INVALID');

  if (typeof fetchImpl !== 'function') throw new Error('FETCH_REQUIRED');
  const headers = {
    apikey: secret,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(String(secret).startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + secret }),
  };
  const response = await fetchImpl(baseUrl + '/functions/v1/' + functionName, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: String(text).trim() }),
  });
  const body = await parseSupabaseResponse(response, 'SUPABASE_MEMORY_EMBED');
  const embedding = body?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== 384 || embedding.some(value => !Number.isFinite(value))) {
    throw new Error('MEMORY_EMBEDDING_SHAPE_INVALID');
  }
  return embedding;
}

export async function searchSharedMemorySemantic({
  query, currentSha, limit = 8, includeCandidates = true, embedding,
} = {}, env = process.env) {
  assertExactSha(currentSha, 'currentSha');
  if (!Array.isArray(embedding) || embedding.length !== 384) throw new Error('MEMORY_EMBEDDING_REQUIRED');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_RESULTS) throw new Error('MEMORY_RETRIEVAL_LIMIT_INVALID');
  return loadRpcClient(env).call('flixo_search_agent_memory_semantic', {
    p_query_embedding: embedding,
    p_query: String(query ?? ''),
    p_current_sha: currentSha,
    p_limit: limit,
    p_include_candidates: includeCandidates,
  });
}

export async function searchEpisodicExperiences({ taskId, currentSha, limit = 10 } = {}, env = process.env) {
  assertExactSha(currentSha, 'currentSha');
  if (!nonEmptyString(taskId)) throw new Error('TASK_ID_REQUIRED');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('EPISODIC_RETRIEVAL_LIMIT_INVALID');
  const params = new URLSearchParams({
    select: 'learning_id,source_agent,source_role,kind,status,task_id,target_sha,claim,content,evidence_refs,provenance,fingerprint,canonical_green,created_at',
    task_id: 'eq.' + taskId,
    target_sha: 'eq.' + currentSha,
    order: 'created_at.desc',
    limit: String(limit),
  });
  const rows = await loadRpcClient(env).get('/rest/v1/flixo_agent_learning_events?' + params.toString());
  if (!Array.isArray(rows)) throw new Error('EPISODIC_RETRIEVAL_INVALID_RESPONSE');
  return rows.map(row => ({ ...row, tested_sha: row.target_sha, memory_kind: 'EPISODIC' }));
}


function loadCanonicalReportScopes() {
  const content = readFileSync('الوكلاء.md', 'utf8');
  const start = content.indexOf('<!-- CANONICAL_AGENT_REGISTRY:START -->');
  const end = content.indexOf('<!-- CANONICAL_AGENT_REGISTRY:END -->');
  if (start < 0 || end <= start) throw new Error('canonical agent registry markers missing');
  const block = content.slice(start, end);
  const jsonStart = block.indexOf('```json');
  const jsonEnd = block.indexOf('```', jsonStart + 7);
  if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error('canonical agent registry JSON missing');
  const registry = JSON.parse(block.slice(jsonStart + 7, jsonEnd).trim());
  return [...(registry.agents ?? []), ...(registry.supportingRoles ?? [])]
    .map(agent => ({ id: agent.id, name: agent.name, report: agent.report }))
    .filter(agent => agent.id && agent.name && agent.report)
    .sort((a, b) => b.name.length - a.name.length);
}

function expectedReportScope(agent) {
  const match = loadCanonicalReportScopes().find(item => item.id === agent || item.name === agent);
  return match?.report ?? null;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function buildKnowledgeKey({ kind, claim, scope = 'repository' }) {
  const safeKind = String(kind ?? 'knowledge').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'knowledge';
  const digest = createHash('sha256')
    .update(JSON.stringify({ kind: String(kind ?? ''), claim: String(claim ?? '').trim(), scope }))
    .digest('hex')
    .slice(0, 24);
  return (safeKind + ':' + digest).slice(0, 255);
}

export function validateMemoryProposal(proposal, currentSha) {
  const failures = [];
  assertExactSha(currentSha, 'currentSha');
  if (!proposal || typeof proposal !== 'object') return ['proposal must be an object'];
  if (!nonEmptyString(proposal.agent)) failures.push('agent is required');
  if (!nonEmptyString(proposal.role)) failures.push('role is required');
  if (!/^(AGENT-[0-9]{2}|SUPPORT-EXPLORER-[0-9]{2})$/i.test(proposal.agentId ?? '')) failures.push('agentId must be a canonical agent id');
  if (proposal.exactSha !== currentSha) failures.push('exactSha must equal currentSha');
  if (!nonEmptyString(proposal.kind)) failures.push('kind is required');
  if (!nonEmptyString(proposal.claim)) failures.push('claim is required');
  if (!nonEmptyString(proposal.content)) failures.push('content is required');
  if (!Array.isArray(proposal.evidenceRefs) || proposal.evidenceRefs.length === 0) failures.push('evidenceRefs are required');
  if (!nonEmptyString(proposal.reportPath)) failures.push('reportPath is required');
  else {
    const normalized = proposal.reportPath.replaceAll('\\', '/');
    const canonicalReport = expectedReportScope(proposal.agent);
    const segments = normalized.split('/');
    if (segments.some(segment => segment === '..' || segment === '.')) failures.push('reportPath contains forbidden traversal segments');
    if (!normalized.startsWith('الوكلاء/التقارير/')) failures.push('reportPath must be inside the canonical agent report center');
    if (normalized.includes('.agent-intelligence/inbox/')) failures.push('inbox path is forbidden');
    if (!canonicalReport || !normalized.startsWith(canonicalReport)) failures.push('reportPath must match the registered report scope for this agent');
  }
  if (proposal.kind && !['LESSON','ANTI_LESSON','HEURISTIC','PATTERN','WARNING','FACT'].includes(String(proposal.kind).toUpperCase())) {
    failures.push('kind is invalid');
  }
  return failures;
}

export function classifyKnowledgeForSha(memory, currentSha) {
  const tested = String(memory?.tested_sha ?? '').toLowerCase();
  const current = assertExactSha(currentSha, 'currentSha');
  const status = String(memory?.status ?? 'CANDIDATE');
  const freshness = tested === current ? 'CURRENT_SHA' : 'STALE_EVIDENCE';
  const usable = status === 'PROMOTED' && freshness === 'CURRENT_SHA';
  return {
    ...memory,
    sha_freshness: freshness,
    usable,
  };
}

export function isPromotableMemory(memory, currentSha) {
  const current = assertExactSha(currentSha, 'currentSha');
  return (
    memory?.tested_sha === current &&
    memory?.status === 'VALIDATED' &&
    Number(memory?.independent_confirmations) >= 2 &&
    Number(memory?.helpful_count) >= 2 &&
    memory?.regression_evidence === true &&
    Number(memory?.harmful_count ?? 0) === 0
  );
}

export function createSupabaseRpcClient({ baseUrl, serviceRoleKey, fetchImpl = globalThis.fetch } = {}) {
  if (!nonEmptyString(baseUrl)) throw new Error('SUPABASE_URL is required');
  if (!nonEmptyString(serviceRoleKey)) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');
  const root = String(baseUrl).replace(/\/+$/, '');
  const headers = {
    apikey: serviceRoleKey,
    ...(String(serviceRoleKey).startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + serviceRoleKey }),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  return {
    async call(functionName, payload = {}) {
      if (!/^[A-Za-z0-9_]+$/.test(functionName)) throw new Error('invalid RPC function name');
      return parseSupabaseResponse(await fetchImpl(root + '/rest/v1/rpc/' + functionName, {
        method: 'POST', headers, body: JSON.stringify(payload),
      }), 'SUPABASE_RPC');
    },
    async get(path) {
      if (!String(path).startsWith('/rest/v1/')) throw new Error('invalid Supabase REST path');
      return parseSupabaseResponse(await fetchImpl(root + String(path), {
        method: 'GET', headers: { ...headers, 'Content-Type': 'application/json' },
      }), 'SUPABASE_REST');
    },
  };
}

export function loadRpcClient(env = process.env) {
  return createSupabaseRpcClient({
    baseUrl: env.SUPABASE_URL || env.SUPABASE_PROJECT_URL,
    serviceRoleKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
    fetchImpl: env.fetchImpl || globalThis.fetch,
  });
}

export async function searchSharedMemory({ query, currentSha, limit = 8, includeCandidates = false }, env = process.env) {
  assertExactSha(currentSha, 'currentSha');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMORY_RESULTS) {
    throw new Error('MEMORY_RETRIEVAL_LIMIT_INVALID');
  }
  return loadRpcClient(env).call('flixo_search_agent_memory', {
    p_query: String(query ?? ''),
    p_current_sha: currentSha,
    p_limit: limit,
    p_include_candidates: includeCandidates,
  });
}

export async function submitMemoryProposal(payload, env = process.env) {
  const currentSha = assertExactSha(payload?.currentSha ?? env.GITHUB_SHA, 'currentSha');
  const failures = validateMemoryProposal(payload, currentSha);
  if (failures.length) throw new Error('MEMORY_PROPOSAL_INVALID:' + failures.join('|'));
  const rpc = loadRpcClient(env);
  const stored = await rpc.call('flixo_submit_agent_memory', {
    p_agent: payload.agent,
    p_role: payload.role,
    p_task_id: payload.taskId,
    p_exact_sha: payload.exactSha,
    p_kind: String(payload.kind).toUpperCase(),
    p_knowledge_key: payload.knowledgeKey || buildKnowledgeKey({ kind: payload.kind, claim: payload.claim, scope: payload.scope ?? 'repository' }),
    p_title: payload.title || payload.claim.slice(0, 300),
    p_claim: payload.claim,
    p_content: payload.content,
    p_scope: payload.scopeJson ?? {},
    p_evidence_refs: payload.evidenceRefs,
    p_provenance: payload.provenance ?? {},
    p_metadata: { ...(payload.metadata ?? {}), agent_id: payload.agentId },
  });

  const semanticConfigured = Boolean(
    (env.SUPABASE_URL || env.SUPABASE_PROJECT_URL) &&
    (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY),
  );
  if (semanticConfigured && stored?.memory_id) {
    try {
      const embedding = await createMemoryEmbedding(
        [payload.title || payload.claim.slice(0, 300), payload.claim, payload.content].join('\n'),
        env,
      );
      await rpc.call('flixo_store_agent_memory_embedding', {
        p_memory_id: stored.memory_id,
        p_embedding: embedding,
      });
      return { ...stored, embedding_status: 'STORED' };
    } catch (error) {
      if (env.SUPABASE_MEMORY_SEMANTIC_STRICT === 'true') throw error;
      return { ...stored, embedding_status: 'DEFERRED', embedding_error: String(error?.message ?? error) };
    }
  }
  return { ...stored, embedding_status: 'NOT_CONFIGURED' };
}

export async function reviewMemory(payload, env = process.env) {
  assertExactSha(payload?.reviewedSha, 'reviewedSha');
  return loadRpcClient(env).call('flixo_review_agent_memory', {
    p_memory_id: payload.memoryId,
    p_reviewer_agent: payload.reviewerAgent,
    p_decision: payload.decision,
    p_reviewed_sha: payload.reviewedSha,
    p_evidence_refs: payload.evidenceRefs ?? [],
    p_regression_confirmed: payload.regressionConfirmed === true,
    p_rationale: payload.rationale ?? '',
  });
}

export async function recordMemoryUsage(payload, env = process.env) {
  assertExactSha(payload?.exactSha, 'exactSha');
  return loadRpcClient(env).call('flixo_record_agent_memory_usage', {
    p_memory_id: payload.memoryId,
    p_agent_id: payload.agentId,
    p_task_id: payload.taskId,
    p_exact_sha: payload.exactSha,
    p_outcome: payload.outcome,
    p_evidence_refs: payload.evidenceRefs ?? [],
    p_notes: payload.notes ?? '',
  });
}

export async function reconcileMemory(payload, env = process.env) {
  assertExactSha(payload?.currentSha, 'currentSha');
  return loadRpcClient(env).call('flixo_reconcile_agent_memory', {
    p_memory_id: payload.memoryId,
    p_current_sha: payload.currentSha,
  });
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = {};
  for (let i = 0; i < rest.length; i += 1) {
    if (!rest[i].startsWith('--')) continue;
    const key = rest[i].slice(2).replaceAll('-', '_');
    const value = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
    args[key] = value;
  }
  return { command, args };
}

function loadPayload(args) {
  if (!args.file) throw new Error('--file is required');
  return JSON.parse(readFileSync(String(args.file), 'utf8'));
}

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (command === 'search') {
    if (!args.query || !args.sha) throw new Error('search requires --query and --sha');
    console.log(JSON.stringify(await searchSharedMemory({
      query: String(args.query),
      currentSha: String(args.sha),
      limit: Number(args.limit ?? 8),
      includeCandidates: args.include_candidates === true,
    }), null, 2));
    return;
  }
  const payload = loadPayload(args);
  let result;
  if (command === 'propose') result = await submitMemoryProposal(payload);
  else if (command === 'review') result = await reviewMemory(payload);
  else if (command === 'use') result = await recordMemoryUsage(payload);
  else if (command === 'reconcile') result = await reconcileMemory(payload);
  else throw new Error('unknown command');
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1]?.endsWith('shared-memory.mjs')) {
  main().catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  });
}
