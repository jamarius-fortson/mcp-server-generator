import { describe, it, expect } from 'vitest';
import { parseSpec } from '../../src/pipeline/parser/index.js';

const minimalOpenApi = {
  openapi: '3.0.3',
  info: { title: 'Test API', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com' }],
  paths: {
    '/users/{userId}': {
      get: {
        summary: 'Get user by ID',
        operationId: 'getUserById',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } }
        }
      }
    }
  }
};

describe('parseSpec', () => {
  it('parses a minimal OpenAPI spec and returns the expected keys', async () => {
    const result = await parseSpec(minimalOpenApi as any);

    expect(result.info.title).toBe('Test API');
    expect(result.info.baseUrl).toBe('https://api.example.com');
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].operationId).toBe('getUserById');
    expect(result.endpoints[0].method).toBe('get');
    expect(result.endpoints[0].path).toBe('/users/{userId}');
  });
});
