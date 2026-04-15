#!/usr/bin/env node
import { Command } from 'commander';
import { runGenerateCommand } from './commands/generate.js';

const program = new Command();

program
  .name('mcp-generate')
  .description('Generate an MCP server from an OpenAPI spec.')
  .version('0.1.0');

program
  .command('generate')
  .argument('<spec-source>', 'OpenAPI spec URL, local file, or - for stdin')
  .option('-o, --output <dir>', 'Output directory', './mcp-server-output')
  .option('--name <name>', 'Server name')
  .option('--mode <mode>', 'Grouping mode: individual|resource|tag|custom', 'resource')
  .option('--include-deprecated', 'Include deprecated endpoints')
  .option('--transport <transport>', 'Transport: stdio|http|both', 'stdio')
  .action(async (specSource, options) => {
    try {
      await runGenerateCommand({ specSource, options });
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse(process.argv);
