import fs from 'node:fs/promises';
import path from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import * as swagger2openapi from 'swagger2openapi';

export type {
  ParsedSpec,
  ParsedSpecInfo,
  ParsedSchema,
  ParsedParameter,
  ParsedRequestBody,
  ParsedResponse,
  ParsedEndpoint,
  AuthConfig,
  ParseWarning
} from './types.js';

import type {
  ParsedSpec,
  ParsedSpecInfo,
  ParsedSchema,
  ParsedParameter,
  ParsedRequestBody,
  ParsedResponse,
  ParsedEndpoint,
  AuthConfig,
  ParseWarning
} from './types.js';

function isUrl(specSource: string): boolean {
  return /^https?:\/\//i.test(specSource);
}

async function readSpecSource(specSource: string): Promise<unknown> {
  if (specSource === '-') {
    const stdin = process.stdin;
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw;
  }

  if (isUrl(specSource)) {
    const resp = await fetch(specSource, { method: 'GET', headers: { 'Accept': 'application/json, application/yaml, */*' }, timeout: 10000 } as any);
    if (!resp.ok) throw new Error(`Failed to fetch spec from URL: ${resp.status} ${resp.statusText}`);
    const ctype = resp.headers.get('content-type') ?? '';
    if (ctype.includes('yaml') || ctype.includes('yml')) {
      return await resp.text();
    }
    return await resp.json();
  }

  // Assume it's a file path
  const filePath = path.resolve(process.cwd(), specSource);
  const data = await fs.readFile(filePath, 'utf8');
  
  // Parse YAML if .yaml or .yml extension
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    const yaml = (await import('js-yaml')).default;
    return yaml.load(data);
  }
  
  return data;
}

function normalizeInfo(api: any): ParsedSpecInfo {
  const title = String(api.info?.title ?? 'Unknown API');
  const version = String(api.info?.version ?? '0.0.0');
  const description = api.info?.description;

  const servers = Array.isArray(api.servers)
    ? (api.servers as Array<any>).map((s) => ({ url: String(s.url), description: s.description }))
    : [{ url: 'http://localhost', description: 'default' }];

  const baseUrl = servers[0]?.url ?? 'http://localhost';

  return { title, version, description, baseUrl, servers };
}

function genOperationId(method: string, pathItem: string, existing: Set<string>): string {
  const raw = `${method}_${pathItem}`
    .replace(/\{(.+?)\}/g, '$1')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();

  let candidate = raw || `${method}_operation`;
  let suffix = 1;
  while (existing.has(candidate)) {
    suffix += 1;
    candidate = `${raw}_${suffix}`;
  }
  existing.add(candidate);
  return candidate;
}

function mapSecuritySchemes(api: any): AuthConfig[] {
  const schemes: AuthConfig[] = [];
  const rawSchemes = api.components?.securitySchemes ?? {};

  for (const [schemeId, scheme] of Object.entries(rawSchemes)) {
    const sc = scheme as any;
    const lower = (sc.type ?? '').toString().toLowerCase();
    const authConfig: AuthConfig = {
      schemeId,
      type: ['apikey', 'http', 'oauth2', 'openidconnect'].includes(lower) ? (lower as any) : 'unknown',
      envVarName: schemeId.replace(/[^A-Za-z0-9]/g, '_').toUpperCase(),
      required: true
    };

    if (lower === 'apikey') {
      authConfig.apiKeyIn = sc.in;
      authConfig.apiKeyName = sc.name;
    }

    if (lower === 'http') {
      authConfig.httpScheme = sc.scheme;
      if (sc.scheme === 'bearer' && sc.bearerFormat) {
        authConfig.bearerFormat = sc.bearerFormat;
      }
    }

    if (lower === 'oauth2') {
      authConfig.oauth2Flows = {
        clientCredentials: sc.flows?.clientCredentials
          ? {
              tokenUrl: sc.flows.clientCredentials.tokenUrl,
              scopes: sc.flows.clientCredentials.scopes ?? {}
            }
          : undefined,
        authorizationCode: sc.flows?.authorizationCode
          ? {
              authUrl: sc.flows.authorizationCode.authorizationUrl,
              tokenUrl: sc.flows.authorizationCode.tokenUrl,
              scopes: sc.flows.authorizationCode.scopes ?? {}
            }
          : undefined
      };
    }

    if (lower === 'openidconnect') {
      authConfig.type = 'openIdConnect';
    }

    schemes.push(authConfig);
  }

  return schemes;
}

function normalizeSchema(schema: any): ParsedSchema {
  if (!schema || typeof schema !== 'object') return { type: typeof schema };

  const normalized: ParsedSchema = {
    type: schema.type,
    format: schema.format,
    description: schema.description,
    required: Array.isArray(schema.required) ? schema.required.map(String) : undefined,
    enum: Array.isArray(schema.enum) ? schema.enum : undefined,
    default: schema.default,
    example: schema.example,
    nullable: Boolean(schema.nullable),
    minLength: schema.minLength,
    maxLength: schema.maxLength,
    minimum: schema.minimum,
    maximum: schema.maximum,
    pattern: schema.pattern
  };

  if (schema.properties && typeof schema.properties === 'object') {
    normalized.properties = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      normalized.properties[k] = normalizeSchema(v);
    }
  }

  if (schema.items) {
    normalized.items = normalizeSchema(schema.items);
  }

  if (schema.allOf) {
    normalized.allOf = (schema.allOf as any[]).map(normalizeSchema);
  }
  if (schema.oneOf) {
    normalized.oneOf = (schema.oneOf as any[]).map(normalizeSchema);
  }
  if (schema.anyOf) {
    normalized.anyOf = (schema.anyOf as any[]).map(normalizeSchema);
  }

  if (schema.discriminator) {
    normalized.discriminator = {
      propertyName: schema.discriminator.propertyName,
      mapping: schema.discriminator.mapping ?? undefined
    };
  }

  return normalized;
}

function extractEndpoints(api: any, warnings: ParseWarning[]): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  const existingOperationIds = new Set<string>();
  const globalSecurity = Array.isArray(api.security) ? api.security : [];

  for (const [pathKey, pathItem] of Object.entries(api.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const method of Object.keys(pathItem)) {
      const lower = method.toLowerCase();
      if (!['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace'].includes(lower)) continue;

      if (['options', 'trace'].includes(lower)) continue;

      const op = (pathItem as any)[method];
      if (!op || typeof op !== 'object') continue;

      const operationId = String(op.operationId ?? genOperationId(lower, pathKey, existingOperationIds));
      if (!op.operationId) {
        warnings.push({ message: `operationId missing for ${method.toUpperCase()} ${pathKey}, generated: ${operationId}` });
      }

      const parameters: ParsedParameter[] = [];
      const pathParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
      const opParams = Array.isArray(op.parameters) ? op.parameters : [];

      const mergedParams = [...pathParams, ...opParams];

      for (const param of mergedParams) {
        if (!param || typeof param !== 'object' || !param.name || !param.in) continue;
        const parsedParam: ParsedParameter = {
          name: String(param.name),
          in: ['path', 'query', 'header', 'cookie'].includes(param.in) ? (param.in as any) : 'query',
          required: Boolean(param.required || param.in === 'path'),
          description: param.description,
          schema: param.schema ? normalizeSchema(param.schema) : undefined,
          example: param.example,
          deprecated: Boolean(param.deprecated)
        };
        parameters.push(parsedParam);
      }

      let requestBody: ParsedRequestBody | undefined;
      if (op.requestBody) {
        const rb = typeof op.requestBody === 'object' ? op.requestBody : {};
        const content = {} as Record<string, ParsedSchema>;
        for (const [mediaType, mediaObj] of Object.entries(rb.content ?? {})) {
          const schemaObj = (mediaObj as any).schema;
          if (schemaObj) {
            content[mediaType] = normalizeSchema(schemaObj);
          }
        }
        requestBody = {
          description: rb.description,
          required: Boolean(rb.required),
          content
        };
      }

      const responses: ParsedResponse[] = [];
      if (op.responses && typeof op.responses === 'object') {
        for (const [statusCode, response] of Object.entries(op.responses)) {
          const r = response as any;
          const content: Record<string, ParsedSchema> = {};
          if (r && r.content && typeof r.content === 'object') {
            for (const [mediaType, mediaObj] of Object.entries(r.content as any)) {
              const schemaObj = (mediaObj as any).schema;
              if (schemaObj) content[mediaType] = normalizeSchema(schemaObj);
            }
          }

          responses.push({ statusCode, description: r?.description, content: Object.keys(content).length ? content : undefined });
        }
      }

      const security = Array.isArray(op.security) ? op.security : globalSecurity;

      endpoints.push({
        operationId,
        method: lower as any,
        path: pathKey,
        summary: op.summary,
        description: op.description,
        tags: Array.isArray(op.tags) ? op.tags.map((t: unknown) => String(t)) : [],
        deprecated: Boolean(op.deprecated),
        parameters,
        requestBody,
        responses,
        security,
        rateLimit: undefined
      });
    }
  }

  return endpoints;
}

export async function parseSpec(specSource: string | object): Promise<ParsedSpec> {
  const warnings: ParseWarning[] = [];

  let api: any;
  if (typeof specSource === 'string') {
    const loaded = await readSpecSource(specSource);
    if (typeof loaded === 'string') {
      // JSON or YAML text
      api = await SwaggerParser.parse(loaded, { resolve: { external: true } });
    } else {
      api = loaded;
    }
  } else {
    // Direct object input (for testing)
    api = specSource;
  }

  if (!api.openapi && api.swagger) {
    const res = await swagger2openapi.convertObj(api, { patch: true });
    api = res.openapi;
    warnings.push({ message: 'Converted Swagger 2.0 to OpenAPI 3.x' });
  }

  await SwaggerParser.validate(api as any, { validate: { spec: true } });

  const dereferenced = await SwaggerParser.dereference(api as any);

  const info = normalizeInfo(dereferenced);
  const auth = mapSecuritySchemes(dereferenced);
  const endpoints = extractEndpoints(dereferenced, warnings);

  const schemas: Record<string, ParsedSchema> = {};
  if (dereferenced.components?.schemas && typeof dereferenced.components.schemas === 'object') {
    for (const [key, value] of Object.entries(dereferenced.components.schemas)) {
      schemas[key] = normalizeSchema(value);
    }
  }

  const stats = {
    totalEndpoints: endpoints.length,
    totalSchemas: Object.keys(schemas).length,
    totalParameters: endpoints.reduce((sum, e) => sum + e.parameters.length, 0),
    estimatedOriginalTokens: typeof specSource === 'string' ? Math.ceil(specSource.length / 4) : 0
  };

  return {
    info,
    auth,
    endpoints,
    schemas,
    warnings,
    stats
  };
}

