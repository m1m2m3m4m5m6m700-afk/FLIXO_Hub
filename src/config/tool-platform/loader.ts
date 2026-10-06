import { TOOL_REGISTRY, TOOL_CATALOG } from '../registry.ts';
import type { ToolDefinition } from '../../lib/tools/tool-registry.ts';
import type { ToolCatalog } from './types.ts';

export const REGISTERED_TOOL_DEFINITIONS: readonly ToolDefinition[] = TOOL_REGISTRY;

export { TOOL_CATALOG };

export function getRegisteredToolDefinitions(): readonly ToolDefinition[] {
  return REGISTERED_TOOL_DEFINITIONS;
}

export function getLoadedToolCatalog(): ToolCatalog {
  return TOOL_CATALOG;
}
