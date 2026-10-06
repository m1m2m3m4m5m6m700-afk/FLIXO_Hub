/** @deprecated Import tool registry APIs from '@/lib/tools/tool-registry' instead. */
export {
  TOOL_REGISTRY,
  TOOL_CATALOG,
  TOOL_DEFINITIONS,
  getToolDefinition,
  getToolById,
  getToolByRoute,
} from '../lib/tools/tool-registry.ts';
export type { ToolDefinition } from './canonical-tool-definition.ts';
