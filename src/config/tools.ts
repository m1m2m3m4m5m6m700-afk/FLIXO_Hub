/** @deprecated Import from '@/lib/tools/tool-registry' for the consolidated tool source. */
export {
  TOOL_REGISTRY as TOOLS_REGISTRY,
  TOOL_MANIFEST as TOOL_MANIFEST_ENTRIES,
  getToolById as getToolConfig,
  getToolByRoute as getToolConfigByPath,
  getToolManifest,
} from '../lib/tools/tool-registry.ts';
export type { ToolDefinition as ToolConfig } from './canonical-tool-definition.ts';
export type ToolComponent = ToolConfig['component'];

export const getReadyToolConfigs = () =>
  TOOL_MANIFEST_ENTRIES.filter((tool) => tool.isReady);
