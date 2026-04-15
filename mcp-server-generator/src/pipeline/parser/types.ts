export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

export interface ParsedSchema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, ParsedSchema>;
  required?: string[];
  items?: ParsedSchema;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  nullable?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  allOf?: ParsedSchema[];
  oneOf?: ParsedSchema[];
  anyOf?: ParsedSchema[];
  discriminator?: { propertyName: string; mapping?: Record<string, string> };
}

export interface ParsedParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema?: ParsedSchema;
  example?: unknown;
  deprecated?: boolean;
}

export interface ParsedRequestBody {
  description?: string;
  required: boolean;
  content: Record<string, ParsedSchema>;
}

export interface ParsedResponse {
  statusCode: string;
  description?: string;
  content?: Record<string, ParsedSchema>;
}

export interface AuthConfig {
  schemeId: string;
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect' | 'unknown';
  apiKeyIn?: 'header' | 'query' | 'cookie';
  apiKeyName?: string;
  httpScheme?: 'bearer' | 'basic' | string;
  bearerFormat?: string;
  oauth2Flows?: {
    clientCredentials?: { tokenUrl: string; scopes: Record<string, string> };
    authorizationCode?: { authUrl: string; tokenUrl: string; scopes: Record<string, string> };
  };
  envVarName: string;
  required: boolean;
}

export interface ParsedEndpoint {
  operationId: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  deprecated: boolean;
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: ParsedResponse[];
  security: Array<Record<string, string[]>>;
  rateLimit?: { requestsPerSecond?: number; requestsPerMinute?: number };
}

export interface ParsedSpecInfo {
  title: string;
  version: string;
  description?: string;
  baseUrl: string;
  servers: Array<{ url: string; description?: string }>;
}

export interface ParseWarning {
  message: string;
  path?: string;
}

export interface ParsedSpec {
  info: ParsedSpecInfo;
  auth: AuthConfig[];
  endpoints: ParsedEndpoint[];
  schemas: Record<string, ParsedSchema>;
  warnings: ParseWarning[];
  stats: {
    totalEndpoints: number;
    totalSchemas: number;
    totalParameters: number;
    estimatedOriginalTokens: number;
  };
}
