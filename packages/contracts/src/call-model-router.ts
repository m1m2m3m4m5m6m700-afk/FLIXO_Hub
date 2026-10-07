/**
 * CALL deterministic model-to-agent router v1.
 *
 * GLM-5.3 is the sole Master. The second roster agent is the independent
 * Opponent, with no planning, certification, or governance authority.
 * Routing is capability selection, never authority.
 */

import {
  CALL_MODEL_CATALOG,
  getCallModel,
  type CallModelRole,
  type CallModelSpec,
} from "./call-model-catalog";

export type CallAgentId =
  | "master"
  | "builder"
  | "opponent"
  | "adversary-builder"
  | "adversary-explorer"
  | "explorer"
  | "verifier"
  | "steward"
  | "vision"
  | "detector"
  | "segmenter"
  | "audio"
  | "memory";

export type CallTaskKind =
  | "plan"
  | "build"
  | "oppose"
  | "red-team"
  | "explore"
  | "verify"
  | "govern"
  | "vision"
  | "detect"
  | "segment"
  | "audio"
  | "retrieve";

export type CallRoutingRequest = Readonly<{
  taskId: string;
  kind: CallTaskKind;
  requiredCapabilities: readonly string[];
  contextClass?: "small" | "medium" | "large" | "xlarge";
  latencyClass?: "fast" | "balanced" | "slow";
  maxRiskClass?: "low" | "medium" | "high";
  excludedModels?: readonly string[];
}>;

export type CallAgentAssignment = Readonly<{
  agentId: CallAgentId;
  modelId: string;
  modelRole: CallModelRole;
  taskId: string;
  capabilities: readonly string[];
  fallbackModels: readonly string[];
}>;

const AGENT_ROLE: Readonly<Record<CallAgentId, CallModelRole>> = Object.freeze({
  master: "master",
  opponent: "opponent",
  builder: "builder",
  "adversary-builder": "red_team",
  "adversary-explorer": "opponent",
  explorer: "explorer",
  verifier: "verifier",
  steward: "verifier",
  vision: "vision",
  detector: "detector",
  segmenter: "segmenter",
  audio: "audio",
  memory: "memory",
});

const TASK_AGENT: Readonly<Record<CallTaskKind, CallAgentId>> = Object.freeze({
  plan: "master",
  build: "builder",
  oppose: "opponent",
  "red-team": "adversary-builder",
  explore: "explorer",
  verify: "verifier",
  govern: "steward",
  vision: "vision",
  detect: "detector",
  segment: "segmenter",
  audio: "audio",
  retrieve: "memory",
});

const score = (model: CallModelSpec, request: CallRoutingRequest): number => {
  if (!model.roles.includes(AGENT_ROLE[TASK_AGENT[request.kind]])) return -1;
  if (request.excludedModels?.includes(model.modelId)) return -1;
  if (request.contextClass && model.contextClass !== request.contextClass) return -1;
  if (request.latencyClass && model.latencyClass !== request.latencyClass) return -1;
  if (request.maxRiskClass === "low" && model.riskClass !== "low") return -1;
  if (request.maxRiskClass === "medium" && model.riskClass === "high") return -1;

  const hits = request.requiredCapabilities.filter((c) => model.capabilities.includes(c)).length;
  if (hits !== request.requiredCapabilities.length) return -1;

  const latency = request.latencyClass === model.latencyClass ? 10 : 0;
  const context = request.contextClass === model.contextClass ? 10 : 0;
  const capability = hits * 100;
  const risk = model.riskClass === "low" ? 3 : model.riskClass === "medium" ? 2 : 1;
  return capability + latency + context + risk;
};

export function routeCallTask(request: CallRoutingRequest): CallAgentAssignment {
  if (!request.taskId.trim()) throw new Error("CALL_ROUTING_TASK_ID_REQUIRED");

  const agentId = TASK_AGENT[request.kind];
  const candidates = CALL_MODEL_CATALOG
    .filter((model) => score(model, request) >= 0)
    .sort((a, b) => a.modelId.localeCompare(b.modelId));

  if (candidates.length === 0) {
    throw new Error("CALL_ROUTING_NO_CAPABLE_MODEL");
  }

  candidates.sort((a, b) => score(b, request) - score(a, request) || a.modelId.localeCompare(b.modelId));
  const selected = candidates[0];

  if (agentId === "master" && selected.modelId !== "GLM-5.3") {
    throw new Error("CALL_MASTER_MUST_BE_GLM_5_3");
  }

  const fallbacks = candidates.slice(1, 4).map((model) => model.modelId);
  return Object.freeze({
    agentId,
    modelId: selected.modelId,
    modelRole: AGENT_ROLE[agentId],
    taskId: request.taskId,
    capabilities: selected.capabilities,
    fallbackModels: fallbacks,
  });
}

export function getCallAgentModel(agentId: CallAgentId): CallModelSpec | undefined {
  const role = AGENT_ROLE[agentId];
  if (agentId === "master") return getCallModel("GLM-5.3");
  return CALL_MODEL_CATALOG.find((model) => model.roles.includes(role));
}

export function listCallAgentAssignments(): readonly { agentId: CallAgentId; role: CallModelRole; preferredModel: string }[] {
  return Object.freeze(
    (Object.keys(AGENT_ROLE) as CallAgentId[]).map((agentId) => ({
      agentId,
      role: AGENT_ROLE[agentId],
      preferredModel: agentId === "master" ? "GLM-5.3" : getCallAgentModel(agentId)?.modelId ?? "",
    })),
  );
}
