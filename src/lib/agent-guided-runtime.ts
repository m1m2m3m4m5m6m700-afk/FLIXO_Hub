  }

  const matched = findIntent(trimmed);
  const params = parametersFor(matched.toolId);
  const plan = parseExecutionPlan({
    workflowName: `FLIXO Agent — ${matched.toolId}`,
    confidence: Math.min(0.99, 0.75 + Math.min(0.24, matched.intent.length / 200)),
    catalogFingerprint: TOOL_CATALOG.fingerprint,
    steps: [{ toolId: matched.toolId, params }],
  });

  return Object.freeze({
    ...plan,
    requiresUserConfirmation: true as const,
    matchedIntent: matched.intent,
  });
}

export async function executeAgentPlan(
  plan: AgentPlan,
  file: File,
  confirmed: boolean,
): Promise<Readonly<{ blob: Blob; fileName: string }>> {
  assertLocalImageFile(file);
  if (!confirmed || plan.requiresUserConfirmation !== true) {
    throw new Error('Execution denied: explicit user confirmation is required.');
  }

  const steps = plan.steps.map((step) => step.toolId);
  if (steps.length !== 1) throw new Error('Agent execution is bounded to one local tool step.');

  const capability = getCapability(steps[0]);
  if (!capability || capability.state !== 'EXECUTABLE' || capability.requirements.network) {
    throw new Error('Execution denied by the canonical capability boundary.');
  }
  if (!CANONICAL_IMAGE_TOOL_IDS.includes(steps[0])) {
    throw new Error('Execution denied: tool is outside the canonical image executor.');
  }
  const parameters = (plan.steps[0].params ?? {}) as Record<string, string | number | boolean>;
  const confirmationToken = await createImageExecutionConfirmationToken(steps[0], parameters, []);
  const receipt: CanonicalImageExecutionReceipt = await executeCanonicalImageTool({
    toolId: steps[0],
    inputBlob: file,
    parameters,
    origin: 'agent',
    confirmed,
    confirmationToken,
  });
  return {
    blob: receipt.outputBlob,
    fileName: file.name,