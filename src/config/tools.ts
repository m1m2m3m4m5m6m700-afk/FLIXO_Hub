import { TOOL_MANIFEST, type ToolDefinition } from '../lib/tools/tool-registry.ts';

/** @deprecated Import from '@/lib/tools/tool-registry' for the consolidated tool source. */
export {
  TOOL_REGISTRY as TOOLS_REGISTRY,
  TOOL_MANIFEST as TOOL_MANIFEST_ENTRIES,
  getToolById as getToolConfig,
  getToolByRoute as getToolConfigByPath,
  getToolManifest,
} from '../lib/tools/tool-registry.ts';
export type ToolConfig = ToolDefinition;
export type ToolComponent = ToolDefinition['component'];

export const getReadyToolConfigs = () => TOOL_MANIFEST.filter((tool) => tool.isReady);
