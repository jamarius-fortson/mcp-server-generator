import { describe, it, expect } from 'vitest';
import { compressDescription, compressParameterDescription } from '../../src/pipeline/optimizer/compressor.js';
import { disambiguateTools } from '../../src/pipeline/optimizer/disambiguator.js';
import { optimizeSpec } from '../../src/pipeline/optimizer/index.js';
import type { MappedTool, MappedSpec } from '../../src/pipeline/mapper/types.js';

describe('Description Compressor', () => {
  it('should remove "This endpoint retrieves" boilerplate', () => {
    const raw = 'This endpoint retrieves a user from the database by their unique identifier.';
    const result = compressDescription(raw, { name: 'get_user' });
    expect(result).toBe('User');
  });

  it('should remove "Returns a JSON object" boilerplate', () => {
    const raw = 'This API call returns a JSON object representing a customer.';
    const result = compressDescription(raw, { name: 'get_customer' });
    expect(result).toBe('A JSON object representing a customer');
  });

  it('should truncate long descriptions', () => {
    const long = 'A'.repeat(1000);
    const result = compressDescription(long, { name: 'test' });
    expect(result.length).toBeLessThanOrEqual(800);
    expect(result).toContain('...');
  });

  it('should generate a description if missing', () => {
    const result = compressDescription(undefined, { name: 'list_users', resource: 'users' });
    expect(result.toLowerCase()).toContain('list users');
    expect(result).toContain('users management');
  });
});

describe('Parameter Description Compressor', () => {
  it('should remove "The unique identifier" boilerplate', () => {
    const raw = 'The unique identifier for the user to retrieve.';
    const result = compressParameterDescription(raw, 'userId');
    expect(result).toBe('User to retrieve');
  });
});

describe('Disambiguator', () => {
  it('should disambiguate identical descriptions using resource info', () => {
    const mockTools: MappedTool[] = [
      {
        name: 'get_user_a',
        description: 'Get user.',
        endpoint: { method: 'GET', path: '/v1/users', baseUrl: '' },
        group: 'v1',
        operationId: 'a',
        parameters: [],
        inputSchema: {},
        auth: [],
        isReadOnly: true,
        hasSideEffects: false
      },
      {
        name: 'get_user_b',
        description: 'Get user.',
        endpoint: { method: 'GET', path: '/v2/users', baseUrl: '' },
        group: 'v2',
        operationId: 'b',
        parameters: [],
        inputSchema: {},
        auth: [],
        isReadOnly: true,
        hasSideEffects: false
      }
    ];

    const result = disambiguateTools([...mockTools]);
    expect(result[0].description).not.toBe(result[1].description);
    expect(result[1].description).toContain('/v2/users');
  });
});
