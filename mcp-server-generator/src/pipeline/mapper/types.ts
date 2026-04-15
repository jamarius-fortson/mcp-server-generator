import type { ParsedEndpoint, ParsedParameter, ParsedRequestBody, AuthConfig } from '../parser/types.js';

export interface MappedParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie' | 'body';
  required: boolean;
  description?: string;
  schema: any;
}

export interface MappedOperation {
  action: string;
  method: string;
  path: string;
  description: string;
  parameters: MappedParameter[];
  operationId: string;
}

export interface MappedTool {
  name: string;
  description: string;
  inputSchema: any;
  parameters: MappedParameter[];
  endpoint: {
    method: string;
    path: string;
    baseUrl: string;
    contentType?: string;
  };
  auth: AuthConfig[];
  isReadOnly: boolean;
  hasSideEffects: boolean;
  group: string;
  operationId: string;
  operations?: MappedOperation[]; // Multiple operations for grouped resource tools
}

export interface MappedSpec {
  tools: MappedTool[];
  original: ParsedEndpoint[];
}
