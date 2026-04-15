import type { ParsedSpec, ParsedEndpoint } from '../parser/types.js';

export interface AnalyzedSpec extends ParsedSpec {
  filteredEndpoints: ParsedEndpoint[];
}

export function analyzeSpec(spec: ParsedSpec, includeDeprecated = false): AnalyzedSpec {
  const filteredEndpoints = spec.endpoints.filter((endpoint) => {
    if (!includeDeprecated && endpoint.deprecated) return false;
    if (endpoint.tags.includes('x-internal')) return false;
    return true;
  });

  return {
    ...spec,
    endpoints: filteredEndpoints,
    filteredEndpoints
  };
}
