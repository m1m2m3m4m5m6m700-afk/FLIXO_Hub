import { TOOL_DEFINITIONS, TOOL_CATALOG } from '../../lib/tools/tool-registry.ts';
import type { ToolDefinition } from '../canonical-tool-definition.ts';
import type { ToolCatalog } from './types.ts';

export const REGISTERED_TOOL_DEFINITIONS: readonly ToolDefinition[] = TOOL_DEFINITIONS;

export { TOOL_CATALOG };

export function getRegisteredToolDefinitions(): readonly ToolDefinition[] {
  return REGISTERED_TOOL_DEFINITIONS;
}

export function getLoadedToolCatalog(): ToolCatalog {
  return TOOL_CATALOG;
}
