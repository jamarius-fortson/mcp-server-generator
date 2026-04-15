import path from 'node:path';
import { parseSpec } from './parser/index.js';
import { analyzeSpec } from './analyzer/index.js';
import { mapSpec } from './mapper/index.js';
import { optimizeSpec } from './optimizer/index.js';
import { emitFull } from './emitter/index.js';

export interface PipelineOptions {
  specSource: string;
  outputDir: string;
  options: Record<string, unknown>;
}

export function buildPipeline() {
  return {
    run: async (pipelineOptions: PipelineOptions) => {
      console.error(`🚀 Starting generation from: ${pipelineOptions.specSource}`);
      
      const parsed = await parseSpec(pipelineOptions.specSource);
      console.error(`✓ Parsed ${parsed.info.title} (v${parsed.info.version})`);
      console.error(`  • Found ${parsed.stats.totalEndpoints} endpoints, ${parsed.stats.totalSchemas} schemas`);

      const analyzed = analyzeSpec(parsed, Boolean(pipelineOptions.options.includeDeprecated));
      const skippedCount = parsed.stats.totalEndpoints - analyzed.filteredEndpoints.length;
      if (skippedCount > 0) {
        console.error(`⚠ ${skippedCount} endpoints skipped (deprecated or x-internal)`);
      }

      console.group(`✓ Building pipeline stages...`);
      const mapped = mapSpec(analyzed, (pipelineOptions.options.mode as any) ?? 'resource');
      console.error(`  • Mapped tools: ${mapped.tools.length}`);
      
      const optimized = optimizeSpec(mapped);
      console.error(`  • Optimized descriptions (semantic compression applied)`);
      console.groupEnd();

      console.error(`✓ Emitting code to: ${pipelineOptions.outputDir}`);
      await emitFull(pipelineOptions.outputDir, optimized, parsed);
      
      console.error(`\n✨ Done! Generated ${mapped.tools.length} MCP tools successfully.`);
      console.error(`\nNext steps:`);
      console.error(`  1. cd ${path.basename(pipelineOptions.outputDir)}`);
      console.error(`  2. cp .env.example .env (Add your API credentials)`);
      console.error(`  3. npm install && npm run build`);
      console.error(`  4. npm start`);
    }
  };
}
