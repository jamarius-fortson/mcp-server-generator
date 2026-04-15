import { describe, it, expect } from 'vitest';
import { parseSpec } from '../../src/pipeline/parser/index.js';
import { analyzeSpec } from '../../src/pipeline/analyzer/index.js';
import { mapSpec } from '../../src/pipeline/mapper/index.js';
import { optimizeSpec } from '../../src/pipeline/optimizer/index.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('End-to-end pipeline', () => {
  it('generates tools from petstore.yaml', async () => {
    const specPath = path.join(__dirname, '../fixtures/petstore.yaml');

    // Stage 1: Parse
    const parsed = await parseSpec(specPath);
    expect(parsed.info.title).toBe('Petstore API');
    expect(parsed.endpoints.length).toBeGreaterThan(0);
    expect(parsed.auth.length).toBeGreaterThan(0);

    // Stage 2: Analyze
    const analyzed = analyzeSpec(parsed);
    expect(analyzed.filteredEndpoints.length).toBeLessThanOrEqual(parsed.endpoints.length);

    // Stage 3: Map
    const mapped = mapSpec(analyzed);
    expect(mapped.tools.length).toBeGreaterThan(0);

    // Verify tool structure
    for (const tool of mapped.tools) {
      expect(tool.name).toBeDefined();
      expect(tool.name).toMatch(/^[a-z_]+$/);
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.endpoint).toBeDefined();
    }

    // Stage 4: Optimize
    const optimized = optimizeSpec(mapped);
    expect(optimized.tools.length).toBeGreaterThan(0);

    // Verify specific tools are generated
    const toolNames = optimized.tools.map((t) => t.name);
    expect(toolNames).toContain('list_pets');
    expect(toolNames).toContain('create_pet');
    expect(toolNames).toContain('get_pet');
  });
});
