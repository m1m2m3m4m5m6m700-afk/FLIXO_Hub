/** @deprecated Import tool types from '@/lib/tools/tool-registry' instead. */
export type { ToolDefinition } from '../../lib/tools/tool-registry.ts';
export type { ManagedTool, ToolCatalog } from '../../lib/tools/tool-registry.ts';
export type ToolCatalogSource = import('../../lib/tools/tool-registry.ts').ToolDefinition;
