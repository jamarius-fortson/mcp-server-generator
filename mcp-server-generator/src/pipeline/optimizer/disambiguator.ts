import type { MappedTool } from '../mapper/types.js';

export function disambiguateTools(tools: MappedTool[]): MappedTool[] {
  const seenDescriptions = new Map<string, MappedTool>();

  for (const tool of tools) {
    const descKey = tool.description.toLowerCase().trim();
    
    if (seenDescriptions.has(descKey)) {
      const existing = seenDescriptions.get(descKey)!;
      
      // If tools have the same description, add context-based disambiguation
      tool.description = `${tool.description} (Resource: ${tool.endpoint.path})`;
      // Ensure the first one also gets context if needed
      if (!existing.description.includes('(Resource:')) {
        existing.description = `${existing.description} (Target: ${existing.name})`;
      }
    } else {
      seenDescriptions.set(descKey, tool);
    }
  }

  return tools;
}
