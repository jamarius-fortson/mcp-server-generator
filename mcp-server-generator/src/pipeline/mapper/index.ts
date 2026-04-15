import type { ParsedSpec, ParsedEndpoint, AuthConfig } from '../parser/types.js';
import type { MappedSpec, MappedTool, MappedParameter } from './types.js';

function toSnakeCase(input: string): string {
  if (!input) return 'unknown_tool';
  return input
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function generateToolName(endpoint: ParsedEndpoint): string {
  if (endpoint.operationId) return toSnakeCase(endpoint.operationId);

  // Generate from method + path segments
  const method = endpoint.method.toLowerCase();
  const pathParts = endpoint.path
    .split('/')
    .filter(p => p && !p.startsWith('{'))
    .map(p => p.charAt(0).toUpperCase() + p.slice(1));
  
  const generated = method + pathParts.join('');
  return toSnakeCase(generated);
}

function describeEndpoint(endpoint: ParsedEndpoint): string {
  const action = endpoint.summary ?? endpoint.description ?? endpoint.operationId;
  const method = endpoint.method.toUpperCase();
  // Using the summary/description first, fallback to generated name
  return action ? action : `${method} endpoint for ${endpoint.path}`;
}

function mapParameters(endpoint: ParsedEndpoint): MappedParameter[] {
  const params: MappedParameter[] = endpoint.parameters.map((p) => ({
    name: toSnakeCase(p.name),
    in: p.in,
    required: p.required,
    description: p.description ?? `${p.name} parameter`,
    schema: p.schema ?? { type: 'string' }
  }));

  if (endpoint.requestBody) {
    params.push({
      name: 'body',
      in: 'body',
      required: endpoint.requestBody.required,
      description: endpoint.requestBody.description ?? 'Request body',
      schema: endpoint.requestBody.content
    });
  }

  return params;
}

function groupNameForEndpoint(endpoint: ParsedEndpoint): string {
  if (endpoint.tags.length) return toSnakeCase(endpoint.tags[0]);
  const firstSegment = endpoint.path.split('/').filter((s) => s && !s.startsWith('{'))[0] ?? 'root';
  return toSnakeCase(firstSegment);
}

export function mapSpec(spec: ParsedSpec, mode: 'resource' | 'individual' | 'tag' = 'resource'): MappedSpec {
  if (mode === 'individual') {
    return { tools: mapIndividual(spec), original: spec.endpoints };
  } else if (mode === 'resource') {
    return { tools: mapResourceGroups(spec), original: spec.endpoints };
  } else {
    // Other modes fallback to individual for now
    return { tools: mapIndividual(spec), original: spec.endpoints };
  }
}

function mapIndividual(spec: ParsedSpec): MappedTool[] {
  return spec.endpoints.map((endpoint) => {
    const parameters = mapParameters(endpoint);
    return createToolInstance(endpoint, parameters, spec.auth, spec.info.baseUrl);
  });
}

function mapResourceGroups(spec: ParsedSpec): MappedTool[] {
  const groups: Record<string, ParsedEndpoint[]> = {};

  for (const endpoint of spec.endpoints) {
    const name = groupNameForEndpoint(endpoint);
    if (!groups[name]) groups[name] = [];
    groups[name].push(endpoint);
  }

  const result: MappedTool[] = [];

  for (const [groupName, endpoints] of Object.entries(groups)) {
    if (endpoints.length === 1) {
      // If only one endpoint in group, use individual tool style
      result.push(createToolInstance(endpoints[0], mapParameters(endpoints[0]), spec.auth, spec.info.baseUrl));
      continue;
    }

    // Multiple endpoints in group -> Create resource tool
    const toolName = `${groupName}_management`;
    const actions = endpoints.map(e => ({
      action: generateActionName(e),
      method: e.method.toUpperCase(),
      path: e.path,
      description: describeEndpoint(e),
      parameters: mapParameters(e),
      operationId: e.operationId
    }));

    // Consolidate all parameters for the tool schema
    const allParams: Record<string, MappedParameter> = {};
    for (const action of actions) {
      for (const p of action.parameters) {
        // If parameter exists with different type/desc, favor the most specific or common one
        allParams[p.name] = p;
      }
    }

    // Add 'action' parameter as the first one
    const inputSchema = {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: actions.map(a => a.action),
          description: `Action to perform on ${groupName}: ${actions.map(a => `${a.action} (${a.method})`).join(', ')}`
        },
        ...Object.values(allParams).reduce((acc: Record<string, any>, p) => {
          acc[p.name] = {
            type: p.schema?.type ?? 'string',
            description: p.description,
            required: false // We mark individual actions as required if we were more advanced, for now keep flexible
          };
          return acc;
        }, {})
      },
      required: ['action']
    };

    result.push({
      name: toolName,
      description: `Manage ${groupName.replace(/_/g, ' ')} resource. Supported actions: ${actions.map(a => a.action).join(', ')}.`,
      inputSchema,
      parameters: Object.values(allParams),
      endpoint: {
        method: 'MULTIPLE', // special value for grouped tools
        path: 'MULTIPLE',
        baseUrl: spec.info.baseUrl
      },
      auth: spec.auth,
      isReadOnly: actions.every(a => a.method === 'GET' || a.method === 'HEAD'),
      hasSideEffects: actions.some(a => !['GET', 'HEAD'].includes(a.method)),
      group: groupName,
      operationId: `${groupName}_composite`,
      operations: actions
    });
  }

  return result;
}

function createToolInstance(endpoint: ParsedEndpoint, parameters: MappedParameter[], auth: AuthConfig[], baseUrl: string): MappedTool {
  const name = generateToolName(endpoint);
  const inputSchema = {
    type: 'object',
    properties: parameters.reduce((acc: Record<string, unknown>, param) => {
      acc[param.name] = {
        type: param.schema?.type ?? 'string',
        description: param.description,
        required: param.required
      };
      return acc;
    }, {}),
    required: parameters.filter((p) => p.required).map((p) => p.name)
  };

  return {
    name,
    description: describeEndpoint(endpoint),
    inputSchema,
    parameters,
    endpoint: {
      method: endpoint.method.toUpperCase(),
      path: endpoint.path,
      baseUrl,
      contentType: 'application/json'
    },
    auth,
    isReadOnly: endpoint.method === 'get' || endpoint.method === 'head',
    hasSideEffects: !['get', 'head'].includes(endpoint.method),
    group: groupNameForEndpoint(endpoint),
    operationId: endpoint.operationId
  };
}

function generateActionName(endpoint: ParsedEndpoint): string {
  const method = endpoint.method.toLowerCase();
  if (method === 'get' && !endpoint.path.includes('{')) return 'list';
  if (method === 'get') return 'get';
  if (method === 'post') return 'create';
  if (method === 'put' || method === 'patch') return 'update';
  if (method === 'delete') return 'delete';
  return method;
}
