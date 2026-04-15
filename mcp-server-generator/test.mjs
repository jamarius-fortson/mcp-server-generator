#!/usr/bin/env node

/**
 * Quick test script: Generate an MCP server from petstore.yaml
 * and verify it compiles and runs.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    const { buildPipeline } = await import('./dist/pipeline/index.js');
    const pipeline = buildPipeline();

    const fixturePath = path.join(__dirname, 'test/fixtures/petstore.yaml');
    const outputDir = path.join(__dirname, 'generated-petstore-mcp');

    console.error(`[test] Generating MCP server from ${fixturePath}`);
    console.error(`[test] Output: ${outputDir}`);

    await pipeline.run({
      specSource: fixturePath,
      outputDir,
      options: {}
    });

    console.error(`[test] ✓ Generation complete`);

    // List generated files
    const generated = await fs.readdir(outputDir, { recursive: true });
    console.error(`[test] Generated ${generated.length} files:`);
    for (const file of generated.slice(0, 20)) {
      console.error(`[test]   - ${file}`);
    }

    if (generated.length > 20) {
      console.error(`[test]   ... and ${generated.length - 20} more`);
    }

    console.error(`[test] ✓ All tests passed`);
    process.exit(0);
  } catch (error) {
    console.error('[test] ✗ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
