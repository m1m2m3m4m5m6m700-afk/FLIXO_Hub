import { createHash } from 'node:crypto';
import { validateKnowledgeSnapshot } from '../repository-knowledge-scan.mjs';
import { preflightMemoryRetrieval } from './shared-memory.mjs';

export const CONTEXT_VERSION = 'flixo-context-package-v1';

function text(value) {
  return typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
}

function termsFrom(task) {
  const raw = [
    task?.title, task?.objective, task?.description, task?.task_id,
    ...(Array.isArray(task?.repo_refs) ? task.repo_refs : []),
    ...(Array.isArray(task?.files) ? task.files : []),
  ].map(text).join(' ').toLowerCase();
  return new Set((raw.match(/[a-z0-9_./-]{3,}|[\u0600-\u06ff]{3,}/giu) ?? [])
    .filter(term => !/^(the|and|for|with|task|todo)$/iu.test(term)));
}

function scorePath(path, terms) {
  const value = String(path).toLowerCase();
  let score = 0;
  for (const term of terms) if (value.includes(term)) score += 3;
  return score;
}

function limitSorted(items, scoreFn, limit) {
  return [...items].sort((a, b) => {
    const delta = scoreFn(b) - scoreFn(a);
    if (delta !== 0) return delta;
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  }).slice(0, limit);
}

export function compileContext({
  task = {},
  worldModel,
  promotedMemory = [],
  recentExperiences = [],
  knownFailures = [],
  currentSha,
  agentContract = {},
  evidenceRequirements = [],
  limits = {},
} = {}) {
  validateKnowledgeSnapshot(worldModel, { currentSha, now: Date.now() });
  const memory = preflightMemoryRetrieval({ currentSha, memories: promotedMemory });
  const terms = termsFrom(task);
  const maxFiles = Number.isInteger(limits.maxFiles) ? Math.max(1, limits.maxFiles) : 40;
  const maxSymbols = Number.isInteger(limits.maxSymbols) ? Math.max(1, limits.maxSymbols) : 80;
  const maxLessons = Number.isInteger(limits.maxLessons) ? Math.max(1, limits.maxLessons) : 20;

  const relevantFiles = limitSorted(
    worldModel.file_index ?? [],
    entry => scorePath(entry.path, terms) + (Array.isArray(task.repo_refs) && task.repo_refs.includes(entry.path) ? 100 : 0),
    maxFiles,
  );
  const relevantPaths = new Set(relevantFiles.map(entry => entry.path));

  const relevantSymbols = limitSorted(
    worldModel.symbol_index ?? [],
    symbol => (relevantPaths.has(symbol.path) ? 5 : 0) + scorePath(symbol.name, terms),
    maxSymbols,
  ).filter(symbol => relevantPaths.has(symbol.path) || scorePath(symbol.name, terms) > 0);

  const relevantDependencies = (worldModel.dependency_graph ?? [])
    .filter(edge => relevantPaths.has(edge.from) || relevantPaths.has(edge.target))
    .slice(0, maxFiles * 4);

  const authorityGraph = worldModel.authority_graph ?? { nodes: [], edges: [], collisions: [] };
  const relevantAuthority = {
    nodes: (authorityGraph.nodes ?? []).filter(node => relevantPaths.has(node.id)),
    edges: (authorityGraph.edges ?? []).filter(edge => relevantPaths.has(edge.from) || relevantPaths.has(edge.to)),
    collisions: authorityGraph.collisions ?? [],
  };

  const currentExperiences = recentExperiences
    .filter(exp => String(exp?.tested_sha ?? exp?.testedSha ?? '').toLowerCase() === currentSha.toLowerCase())
    .slice(0, 20);
  const staleExperiences = recentExperiences
    .filter(exp => !currentExperiences.includes(exp))
    .slice(0, 20)
    .map(exp => ({
      experience_id: exp?.experience_id ?? exp?.id,
      tested_sha: exp?.tested_sha ?? exp?.testedSha,
      warning: 'stale experience evidence; context-only warning',
    }));

  const currentFailures = knownFailures
    .filter(failure => String(failure?.tested_sha ?? currentSha).toLowerCase() === currentSha.toLowerCase())
    .slice(0, 20);
  const staleFailures = knownFailures
    .filter(failure => !currentFailures.includes(failure))
    .slice(0, 20)
    .map(failure => ({
      id: failure?.id ?? failure?.failure_id,
      tested_sha: failure?.tested_sha,
      warning: 'stale failure evidence; context-only warning',
    }));

  const context = {
    context_version: CONTEXT_VERSION,
    task: {
      task_id: task.task_id ?? null,
      title: task.title ?? null,
      objective: task.objective ?? null,
    },
    current_sha: currentSha.toLowerCase(),
    relevant_files: relevantFiles,
    relevant_symbols: relevantSymbols,
    relevant_dependencies: relevantDependencies,
    relevant_authority: relevantAuthority,
    executable_memory: memory.executableMemory.slice(0, maxLessons),
    memory_warnings: memory.warnings.slice(0, maxLessons),
    recent_experiences: currentExperiences,
    experience_warnings: staleExperiences,
    known_failures: currentFailures,
    failure_warnings: staleFailures,
    agent_contract: {
      name: agentContract.name ?? null,
      scope: agentContract.scope ?? null,
      capabilities: Array.isArray(agentContract.capabilities) ? agentContract.capabilities : [],
    },
    evidence_requirements: Array.isArray(evidenceRequirements) ? evidenceRequirements : [],
    known_unknowns: [worldModel.unknowns ?? {}, ...staleExperiences, ...staleFailures],
    constraints: {
      planner_authority: false,
      mutation_authority: false,
      certification_authority: false,
      executable_memory_requires_promoted_current_sha: true,
    },
  };
  context.context_hash = createHash('sha256').update(JSON.stringify(context)).digest('hex');
  return context;
}

export function memoryPreflightForContext(memories, currentSha) {
  return preflightMemoryRetrieval({ currentSha, memories });
}
