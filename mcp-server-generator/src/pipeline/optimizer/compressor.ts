export function compressDescription(description: string | undefined, context: { name: string; resource?: string }): string {
  if (!description) {
    // Generate from context if missing
    const name = context.name.replace(/_/g, ' ');
    return `${name.charAt(0).toUpperCase() + name.slice(1)}. ${context.resource ? `Part of ${context.resource} management.` : ''}`;
  }

  let compressed = description.trim();

  // 1. Remove obvious context / boilerplate phrases
  const patterns = [
    /^This endpoint (retrieves|creates|updates|deletes|manages|is used to|provides|allows)\s+(a|an|the)?/i,
    /^(Retrieves|Creates|Updates|Deletes|Manages|Provides|Allows)\s+(a|an|the)?/i,
    /^This API call\s+(returns|provides|allows)?/i,
    /returns\s+(a|an|the)?\s+.*?\s+JSON\s+object\s+representing\s+(a|an|the)?/i,
    /returns\s+(a|an|the)?\s+.*?\s+JSON\s+object\s+with/i,
    /represented\s+as\s+(a|an)?\s+.*?\s+object/i,
    /from\s+the\s+(database|system|server|api)/i,
    /by\s+(their|its|the)\s+unique\s+identifier/i,
    /including\s+(their|its|the)\s+/i,
    /Sends\s+a\s+(POST|GET|PUT|DELETE|PATCH)\s+request\s+to/i
  ];

  for (const pattern of patterns) {
    compressed = compressed.replace(pattern, '').trim();
  }

  // 2. Collapse multiple spaces and remove trailing/leading punctuation that became dangling
  compressed = compressed.replace(/\s+/g, ' ');
  compressed = compressed.replace(/^[\s,.;:]+/, '').replace(/[\s,.;:]+$/, '');

  // 3. Capitalize first letter
  if (compressed.length > 0) {
    compressed = compressed.charAt(0).toUpperCase() + compressed.slice(1);
  } else {
    // If empty after compression, use context
    const name = context.name.replace(/_/g, ' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  // 4. Sentence-level compression
  const sentences = compressed.split(/[.!?]+\s+/);
  if (sentences.length > 3) {
    compressed = sentences.slice(0, 3).join('. ');
  }

  // 5. Token limit enforcement (rough char-to-token approximation: 4 chars = 1 token)
  if (compressed.length > 800) {
    compressed = compressed.substring(0, 797) + '...';
  }

  return compressed;
}

export function compressParameterDescription(description: string | undefined, name: string): string {
  if (!description) return `Parameter: ${name}`;
  
  let compressed = description.trim();
  
  const patterns = [
    /^The\s+(unique\s+)?identifier\s+(for|of)\s+(the\s+)?/i,
    /^The\s+name\s+of\s+(the\s+)?/i,
    /^Specify\s+(the\s+)?/i,
    /^Required\s+for\s+(the\s+)?/i
  ];

  for (const pattern of patterns) {
    compressed = compressed.replace(pattern, '').trim();
  }

  compressed = compressed.replace(/\s+/g, ' ');
  compressed = compressed.replace(/^[\s,.;:]+/, '').replace(/[\s,.;:]+$/, '');

  if (compressed.length > 0) {
    compressed = compressed.charAt(0).toUpperCase() + compressed.slice(1);
  }
  return compressed;
}
