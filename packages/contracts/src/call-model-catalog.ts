/**
 * CALL model catalog v1.
 *
 * This is a declared/offline routing catalog. It does not assert that every
 * listed model has been independently license-, weight-, or hardware-verified.
 * Models are capabilities, not authorities. Policy remains the authority.
 */

export type CallModelFamily =
  | "reasoning"
  | "coding"
  | "vision"
  | "detection"
  | "segmentation"
  | "audio"
  | "embedding"
  | "reranking"
  | "edge"
  | "general";

export type CallModelRole =
  | "planner"
  | "builder"
  | "opponent"
  | "red_team"
  | "explorer"
  | "verifier"
  | "vision"
  | "detector"
  | "segmenter"
  | "audio"
  | "memory"
  | "router"
  | "fallback";

export type CallModelSpec = Readonly<{
  modelId: string;
  family: CallModelFamily;
  roles: readonly CallModelRole[];
  capabilities: readonly string[];
  contextClass: "small" | "medium" | "large" | "xlarge";
  latencyClass: "fast" | "balanced" | "slow";
  riskClass: "low" | "medium" | "high";
  offlineDeclared: true;
  status: "declared";
  fallbacks: readonly string[];
}>;

const rows: ReadonlyArray<Omit<CallModelSpec, "offlineDeclared" | "status">> = [
  // Reasoning / agentic
  ["MiMo-V2.6-Pro","reasoning",["planner","opponent","verifier"],["reasoning","planning","analysis"],"xlarge","slow","high"],
  ["GLM-5.3","reasoning",["planner","builder","opponent","verifier"],["reasoning","coding","analysis"],"xlarge","slow","high"],
  ["GLM-5.3-Flash","reasoning",["planner","builder","opponent"],["reasoning","fast-analysis","coding"],"large","fast","medium"],
  ["GLM-5.2","reasoning",["planner","builder","verifier"],["reasoning","coding"],"large","balanced","medium"],
  ["Kimi K3","reasoning",["planner","explorer"],["long-context","research","synthesis"],"xlarge","slow","high"],
  ["Kimi K2.7-Code","coding",["builder","opponent","red_team"],["coding","repository-reasoning","security"],"xlarge","slow","high"],
  ["Kimi K2.6","reasoning",["planner","explorer","builder"],["long-context","reasoning","coding"],"xlarge","slow","high"],
  ["DeepSeek V4-Pro","reasoning",["planner","opponent","verifier"],["reasoning","logic","coding"],"xlarge","slow","high"],
  ["DeepSeek V4.1-Flash","reasoning",["opponent","verifier","router"],["fast-reasoning","analysis"],"large","fast","medium"],
  ["DeepSeek V4","reasoning",["opponent","red_team","verifier"],["logic","falsification","analysis"],"xlarge","slow","high"],
  ["Qwen3.8-2.4T-A95B","reasoning",["planner","explorer"],["large-scale-reasoning","planning"],"xlarge","slow","high"],
  ["Qwen3.6-32B","reasoning",["planner","explorer","builder"],["reasoning","coding","research"],"large","balanced","medium"],
  ["Qwen3.5","reasoning",["planner","explorer","verifier"],["reasoning","multilingual","arabic"],"large","balanced","medium"],
  ["Mistral Large 3 675B","reasoning",["planner","explorer","verifier"],["reasoning","long-context","synthesis"],"xlarge","slow","high"],
  ["Llama 4 Maverick","general",["planner","explorer","builder"],["reasoning","multimodal","long-context"],"xlarge","slow","high"],
  ["Llama 4 Scout","general",["explorer","opponent","verifier"],["long-context","analysis"],"xlarge","balanced","medium"],
  ["gpt-oss 120B","general",["planner","builder","verifier"],["reasoning","coding","general"],"xlarge","slow","high"],

  // Coding / execution
  ["Qwen3-30B-A3B","coding",["builder","verifier","router"],["coding","fast-execution","tool-use"],"large","balanced","medium"],
  ["Qwen2.5-Coder-32B","coding",["builder","red_team"],["coding","repository-editing","testing"],"large","balanced","high"],
  ["DeepSeek-R1","reasoning",["planner","opponent","verifier"],["reasoning","math","falsification"],"xlarge","slow","high"],
  ["DeepSeek-R1-Distill","reasoning",["builder","verifier","fallback"],["reasoning","bounded-coding"],"large","balanced","medium"],
  ["Llama 3.3 70B","general",["builder","verifier","explorer"],["coding","analysis","synthesis"],"large","balanced","medium"],
  ["Llama 3.1 405B Q4","general",["planner","explorer","verifier"],["reasoning","long-context","synthesis"],"xlarge","slow","high"],
  ["Qwen2.5 72B","general",["planner","builder","verifier"],["reasoning","coding","multilingual"],"large","balanced","medium"],
  ["Gemma 4","general",["builder","verifier","fallback"],["bounded-coding","testing"],"medium","fast","low"],
  ["Gemma 3","general",["builder","explorer","fallback"],["bounded-coding","analysis"],"medium","fast","low"],
  ["Gemma 2","general",["fallback","router"],["classification","bounded-generation"],"medium","fast","low"],
  ["Mistral Small 3.1","coding",["builder","verifier","router"],["fast-coding","tool-use"],"medium","fast","medium"],
  ["Mistral Small 3.2","coding",["builder","opponent","verifier"],["fast-coding","testing"],"medium","fast","medium"],
  ["Phi-4","edge",["builder","verifier","router"],["edge-reasoning","bounded-coding"],"small","fast","low"],
  ["Phi-3.5 Mini","edge",["router","fallback"],["edge-reasoning","classification"],"small","fast","low"],
  ["SmolLM2","edge",["router","fallback"],["lightweight-generation","classification"],"small","fast","low"],
  ["OLMo 2","edge",["explorer","fallback"],["local-reasoning","analysis"],"medium","balanced","medium"],
  ["MiniCPM5","edge",["router","builder"],["edge-coding","local-reasoning"],"small","fast","low"],
  ["Granite","general",["builder","verifier","router"],["enterprise-coding","tool-use"],"medium","balanced","medium"],
  ["Falcon","general",["fallback","explorer"],["generation","analysis"],"large","balanced","medium"],
  ["Sarvam","general",["explorer","verifier"],["multilingual","regional-language"],"medium","balanced","medium"],
  ["Hunyuan","general",["planner","builder","explorer"],["reasoning","multimodal"],"large","balanced","medium"],

  // Vision
  ["Qwen3-VL","vision",["vision","explorer","verifier"],["vision-reasoning","OCR","multimodal"],"xlarge","slow","high"],
  ["Qwen2.5-VL-72B","vision",["vision","explorer","verifier"],["vision-reasoning","OCR","multimodal"],"xlarge","slow","high"],
  ["Llama 4 Vision","vision",["vision","explorer"],["multimodal-analysis"],"xlarge","slow","high"],
  ["InternVL3","vision",["vision","verifier"],["vision-reasoning","OCR"],"large","balanced","high"],
  ["InternVL3.5","vision",["vision","explorer","verifier"],["vision-reasoning","OCR","multimodal"],"large","balanced","high"],
  ["Pixtral 12B","vision",["vision","verifier"],["vision","document-analysis"],"large","balanced","medium"],
  ["Florence-2 Large","vision",["vision","detector"],["captioning","OCR","grounding"],"medium","fast","medium"],
  ["LLaVA-OneVision","vision",["vision","explorer"],["multimodal-analysis"],"large","balanced","medium"],
  ["LLaVA-NeXT","vision",["vision","explorer"],["image-understanding"],"large","balanced","medium"],
  ["Moondream","vision",["vision","router"],["lightweight-vision"],"small","fast","low"],
  ["SmolVLM","vision",["vision","router"],["lightweight-vision"],"small","fast","low"],

  // Detection / segmentation
  ["YOLO11x","detection",["detector","verifier"],["object-detection","counting"],"large","fast","medium"],
  ["YOLO11s","detection",["detector","router"],["edge-detection","counting"],"small","fast","low"],
  ["YOLOE-26x","detection",["detector","verifier"],["open-vocabulary-detection"],"large","fast","medium"],
  ["RT-DETR","detection",["detector","verifier"],["object-detection"],"large","balanced","medium"],
  ["DETA","detection",["detector","verifier"],["object-detection"],"large","balanced","medium"],
  ["SAM2","segmentation",["segmenter","vision","verifier"],["segmentation","tracking"],"large","balanced","medium"],

  // Audio
  ["Whisper Large-v3 Turbo","audio",["audio","verifier"],["speech-to-text","timestamps"],"large","fast","medium"],
  ["Fish Audio","audio",["audio"],["speech-generation","voice"],"large","balanced","medium"],
  ["Parakeet TDT","audio",["audio","verifier"],["speech-to-text"],"medium","fast","medium"],
  ["Silero VAD","audio",["audio","router"],["voice-activity-detection"],"small","fast","low"],

  // Memory
  ["BGE-M3","embedding",["memory","router"],["multilingual-embedding","retrieval"],"medium","fast","low"],
  ["E5-Mistral 7B","embedding",["memory"],["embedding","retrieval"],"large","balanced","medium"],
  ["Nomic Embed v1.5","embedding",["memory","router"],["embedding","retrieval"],"medium","fast","low"],
  ["GTE-Qwen2 7B","embedding",["memory"],["embedding","retrieval"],"large","balanced","medium"],
  ["Jina Embed v3","embedding",["memory","router"],["embedding","multilingual-retrieval"],"medium","fast","low"],
  ["BGE Reranker v2","reranking",["memory","verifier"],["reranking","evidence-selection"],"medium","fast","medium"],
];

export const CALL_MODEL_CATALOG_VERSION = "1.0.0" as const;

export const CALL_MODEL_CATALOG: readonly CallModelSpec[] = Object.freeze(
  rows.map(([modelId,family,roles,capabilities,contextClass,latencyClass,riskClass]) =>
    Object.freeze({
      modelId,family,roles,capabilities,contextClass,latencyClass,riskClass,
      offlineDeclared:true as const,
      status:"declared" as const,
      fallbacks:[] as readonly string[],
    }),
  ),
);

export function getCallModel(modelId: string): CallModelSpec | undefined {
  return CALL_MODEL_CATALOG.find((model) => model.modelId === modelId);
}

export function listCallModelsByRole(role: CallModelRole): readonly CallModelSpec[] {
  return CALL_MODEL_CATALOG.filter((model) => model.roles.includes(role));
}

export function listCallModelsByCapability(capability: string): readonly CallModelSpec[] {
  return CALL_MODEL_CATALOG.filter((model) => model.capabilities.includes(capability));
}
