import path from 'node:path';
import { buildPipeline } from '../../pipeline/index.js';

export interface GenerateOptions {
  output?: string;
  name?: string;
  mode?: string;
  includeDeprecated?: boolean;
  transport?: string;
}

export async function runGenerateCommand(args: { specSource: string; options: GenerateOptions }): Promise<void> {
  const { specSource, options } = args;

  const outputDir = path.resolve(process.cwd(), options.output ?? './mcp-server-output');

  console.error(`Starting mcp-server-generator for spec ${specSource}`);

  const pipeline = buildPipeline();
  await pipeline.run({ specSource, outputDir, options });

  console.error(`Done. Generated output to ${outputDir}`);
}
