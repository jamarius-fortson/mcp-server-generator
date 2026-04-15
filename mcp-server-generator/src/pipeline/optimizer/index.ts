import type { MappedSpec } from '../mapper/types.js';
import { compressDescription, compressParameterDescription } from './compressor.js';
import { disambiguateTools } from './disambiguator.js';

export function optimizeSpec(mapped: MappedSpec): MappedSpec {
  // 1. Compress tool and parameter descriptions
  const optimizedTools = mapped.tools.map(tool => {
    return {
      ...tool,
      description: compressDescription(tool.description, { name: tool.name, resource: tool.group }),
      parameters: tool.parameters.map(param => ({
        ...param,
        description: compressParameterDescription(param.description, param.name)
      }))
    };
  });

  // 2. Disambiguate similar tools
  const disambiguatedTools = disambiguateTools(optimizedTools);

  return {
    ...mapped,
    tools: disambiguatedTools
  };
}
