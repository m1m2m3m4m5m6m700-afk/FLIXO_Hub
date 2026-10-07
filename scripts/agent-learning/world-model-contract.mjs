import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const WORLD_MODEL_VERSION = 'flixo-world-model-v1';
export const REQUIRED_SNAPSHOT_LAYERS = Object.freeze([
  'file_index',
  'symbol_index',
  'dependency_graph',
  'call_graph',
  'control_flow_graph',
  'authority_graph',
  'task_graph',
  'semantic_diff',
]);

export function validateKnowledgeSnapshot(snapshot, { currentSha, now = Date.now() } = {}) {
  if (!/^[0-9a-f]{40}$/i.test(String(currentSha ?? ''))) throw new Error('WORLD_MODEL_INVALID_CURRENT_SHA');
  if (!snapshot || typeof snapshot !== 'object') throw new Error('WORLD_MODEL_INVALID_SNAPSHOT');
  const sha = String(currentSha).toLowerCase();
  if (snapshot.model_version !== WORLD_MODEL_VERSION) throw new Error('WORLD_MODEL_VERSION_MISMATCH');
  if (snapshot.exact_sha !== sha) throw new Error('WORLD_MODEL_SHA_MISMATCH');
  if (snapshot.snapshot_id !== WORLD_MODEL_VERSION + ':' + sha) throw new Error('WORLD_MODEL_IDENTITY_MISMATCH');
  const generatedMs = Date.parse(String(snapshot.generated_at ?? ''));
  if (!Number.isFinite(generatedMs)) throw new Error('WORLD_MODEL_TIMESTAMP_INVALID');
  if (generatedMs > Number(now)) throw new Error('WORLD_MODEL_TIMESTAMP_IN_FUTURE');
  if (snapshot.repository_state?.execution_sha !== sha) throw new Error('WORLD_MODEL_REPOSITORY_SHA_MISMATCH');
  for (const layer of REQUIRED_SNAPSHOT_LAYERS) {
    if (snapshot[layer] === undefined) throw new Error('WORLD_MODEL_LAYER_MISSING:' + layer);
  }
  if (!Array.isArray(snapshot.file_index) || !Array.isArray(snapshot.symbol_index) ||
      !Array.isArray(snapshot.dependency_graph) || !Array.isArray(snapshot.call_graph) ||
      !Array.isArray(snapshot.control_flow_graph) || !snapshot.authority_graph ||
      !Array.isArray(snapshot.task_graph?.nodes) || !Array.isArray(snapshot.task_graph?.edges)) {
    throw new Error('WORLD_MODEL_LAYER_SHAPE_INVALID');
  }
  if (snapshot.constraints?.mutation_authority !== false) throw new Error('WORLD_MODEL_MUTATION_AUTHORITY_INVALID');
  if (!snapshot.evidence_catalog || typeof snapshot.evidence_catalog !== 'object') throw new Error('WORLD_MODEL_EVIDENCE_CATALOG_MISSING');
  if (!Array.isArray(snapshot.integrity?.authority_collisions)) throw new Error('WORLD_MODEL_AUTHORITY_INTEGRITY_MISSING');
  if (snapshot.integrity.authority_collisions.length > 0) {
    throw new Error('WORLD_MODEL_DUPLICATE_AUTHORITY:' + snapshot.integrity.authority_collisions.map(item => item.symbol).join(','));
  }
  return {
    valid: true,
    exactSha: sha,
    snapshotId: snapshot.snapshot_id,
    generatedAt: snapshot.generated_at,
  };
}

export function writeImmutableFile(path, content) {
  try {
    writeFileSync(path, content, { encoding: 'utf8', flag: 'wx' });
    return { created: true, identical: false };
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const existing = readFileSync(path, 'utf8');
    if (existing !== content) throw new Error('IMMUTABLE_KNOWLEDGE_SNAPSHOT_COLLISION:' + path);
    return { created: false, identical: true };
  }
}
