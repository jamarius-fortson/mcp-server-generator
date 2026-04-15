import fs from 'node:fs/promises';
import path from 'node:path';
import type { ParsedSpec } from '../parser/index.js';
import type { MappedSpec, MappedTool } from '../mapper/types.js';

function escapeString(s: string): string {
  return JSON.stringify(s);
}

function generateHTTPModule(): string {
  return `export class HttpClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.timeout = parseInt(process.env.API_TIMEOUT_MS || '30000');
  }

  async request(
    method: string,
    path: string,
    options?: {
      headers?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
      timeout?: number;
    }
  ): Promise<{ status: number; data: unknown }> {
    const url = new URL(path.startsWith('/') ? path : \`/\${path}\`, this.baseUrl);
    const maxRetries = 2;
    let attempt = 0;

    if (options?.query) {
      for (const [k, v] of Object.entries(options.query)) {
        url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'mcp-server-generator/0.1.0',
      ...options?.headers
    };

    const body = options?.body ? JSON.stringify(options.body) : undefined;
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options?.timeout || this.timeout);

        const response = await fetch(url.toString(), {
          method: method.toUpperCase(),
          headers,
          body,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Retry on rate limit or server errors
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
          continue;
        }

        const contentType = response.headers.get('content-type') ?? '';
        let data: unknown;

        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        return { status: response.status, data };
      } catch (error: any) {
        if (attempt < maxRetries && (error.name === 'AbortError' || error.name === 'FetchError')) {
           attempt++;
           await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
           continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }
}
`;
}

function generateAuthModule(): string {
  return `import { HttpClient } from './http.js';

let oauthTokenCache: Record<string, { token: string; expiresAt: number }> = {};

export async function applyAuth(
  headers: Record<string, string>,
  query: URLSearchParams,
  schemes: any[]
): Promise<void> {
  const httpClient = new HttpClient(''); // Used for token requests

  for (const scheme of schemes) {
    if (scheme.type === 'apiKey' && scheme.apiKeyName) {
      const apiKey = process.env[scheme.envVarName];
      if (!apiKey) throw new Error(\`Missing env var: \${scheme.envVarName}\`);

      if (scheme.apiKeyIn === 'header') {
        headers[scheme.apiKeyName] = apiKey;
      } else if (scheme.apiKeyIn === 'query') {
        query.set(scheme.apiKeyName, apiKey);
      }
    } else if (scheme.type === 'http' && scheme.httpScheme === 'bearer') {
      const token = process.env[scheme.envVarName];
      if (!token) throw new Error(\`Missing env var: \${scheme.envVarName}\`);
      headers['Authorization'] = \`Bearer \${token}\`;
    } else if (scheme.type === 'http' && scheme.httpScheme === 'basic') {
      const user = process.env[scheme.envVarName + '_USER'];
      const pass = process.env[scheme.envVarName + '_PASS'];
      if (!user || !pass) throw new Error(\`Missing env vars for basic auth\`);
      const encoded = Buffer.from(\`\${user}:\${pass}\`).toString('base64');
      headers['Authorization'] = \`Basic \${encoded}\`;
    } else if (scheme.type === 'oauth2') {
      const flow = scheme.oauth2Flows?.clientCredentials;
      if (flow) {
        const clientId = process.env[scheme.envVarName + '_CLIENT_ID'];
        const clientSecret = process.env[scheme.envVarName + '_CLIENT_SECRET'];
        
        if (!clientId || !clientSecret) {
          throw new Error(\`Missing OAuth2 Client Credentials env vars for \${scheme.schemeId}\`);
        }

        const cacheKey = \`\${scheme.schemeId}_\${clientId}\`;
        const cached = oauthTokenCache[cacheKey];

        if (cached && cached.expiresAt > Date.now() + 60000) {
          headers['Authorization'] = \`Bearer \${cached.token}\`;
        } else {
          // Token request
          const response = await fetch(flow.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: clientId,
              client_secret: clientSecret,
              ...(Object.keys(flow.scopes).length > 0 ? { scope: Object.keys(flow.scopes).join(' ') } : {})
            })
          });

          if (!response.ok) {
            throw new Error(\`OAuth2 token request failed: \${response.status}\`);
          }

          const data = await response.json() as any;
          oauthTokenCache[cacheKey] = {
            token: data.access_token,
            expiresAt: Date.now() + (data.expires_in * 1000)
          };
          headers['Authorization'] = \`Bearer \${data.access_token}\`;
        }
      }
    }
  }
}
`;
}

function generateToolsModule(tools: MappedTool[], auth: ParsedSpec['auth']): string {
  const authSchemes = JSON.stringify(auth, null, 2);

  let toolsCode = `import { HttpClient } from './http.js';
import { applyAuth } from './auth.js';

const authSchemes = ${authSchemes};

export const tools = [
`;

  for (const tool of tools) {
    const inputSchemaStr = JSON.stringify(tool.inputSchema, null, 2);
    
    toolsCode += `  {
    name: ${escapeString(tool.name)},
    description: ${escapeString(tool.description)},
    inputSchema: ${inputSchemaStr},
    run: async (args: Record<string, unknown>) => {
      try {
        const client = new HttpClient(${escapeString(tool.endpoint.baseUrl)});
        const headers: Record<string, string> = {};
        const query = new URLSearchParams();

        // Apply authentication
        if (authSchemes && authSchemes.length > 0) {
          await applyAuth(headers, query, authSchemes);
        }

        let method: string;
        let path: string;
        let body: unknown;

        if (${!!tool.operations && tool.operations.length > 0}) {
          // Dispatched action logic
          const action = String(args.action);
          const operations = ${JSON.stringify(tool.operations)};
          const op = operations.find(o => o.action === action);
          
          if (!op) throw new Error(\`Unknown action: \${action}\`);
          
          method = op.method;
          path = op.path;

          // Substitute path parameters for the specific operation
          for (const p of op.parameters) {
             if (p.in === 'path') {
                path = path.replace(\`{\${p.name}}\`, String(args[p.name] ?? ''));
             } else if (p.in === 'query') {
                if (args[p.name] !== undefined) query.set(p.name, String(args[p.name]));
             } else if (p.in === 'body') {
                body = args[p.name] || args.body;
             }
          }
        } else {
          // Traditional single-endpoint logic
          method = ${escapeString(tool.endpoint.method)};
          path = ${escapeString(tool.endpoint.path)};
          
          const pathParams = ${JSON.stringify(tool.parameters.filter(p => p.in === 'path').map(p => p.name))};
          for (const paramName of pathParams) {
            path = path.replace(\`{\${paramName}}\`, String(args[paramName] ?? ''));
          }

          const queryParams = ${JSON.stringify(tool.parameters.filter(p => p.in === 'query').map(p => p.name))};
          for (const param of queryParams) {
            if (args[param] !== undefined) query.set(param, String(args[param]));
          }

          if (${tool.parameters.some(p => p.in === 'body')}) {
            body = args.body;
          }
        }

        const response = await client.request(method, path, {
          headers,
          query: Object.fromEntries(query),
          body,
          timeout: 30000
        });

        if (response.status >= 400) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: true, code: 'API_ERROR', message: \`API returned \${response.status}\`, data: response.data }) }],
            isError: true
          };
        }

        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: true, code: 'REQUEST_ERROR', message: error instanceof Error ? error.message : String(error) }) }],
          isError: true
        };
      }
    }
  },
`;
  }

  toolsCode += `];
`;
  return toolsCode;
}

function generateServerModule(title: string): string {
  return `import { MCPServer } from '@modelcontextprotocol/sdk';
import { tools } from './tools.js';

export async function startMCPServer(): Promise<void> {
  const server = new MCPServer({
    name: ${escapeString(title)},
    version: '0.1.0'
  });

  // Register all tools
  for (const tool of tools) {
    server.registerTool(tool as any);
  }

  // Connect on stdio transport
  await server.connect({
    transport: 'stdio'
  });
}
`;
}

function generateIndexModule(): string {
  return `#!/usr/bin/env node
import { startMCPServer } from './server.js';

startMCPServer().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
`;
}

function generateTsconfig(): unknown {
  return {
    compilerOptions: {
      target: 'ES2020',
      module: 'ES2020',
      moduleResolution: 'node',
      strict: true,
      outDir: 'dist',
      rootDir: 'src',
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      declaration: true
    },
    include: ['src'],
    exclude: ['node_modules']
  };
}

function generatePackageJson(name: string): unknown {
  return {
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      build: 'tsc',
      start: 'node dist/index.js'
    },
    bin: { [name]: './dist/index.js' },
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.0.0'
    },
    devDependencies: {
      typescript: '^5.0.0'
    }
  };
}

function generateDockerfile(name: string): string {
  return `FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
`;
}

function generateEnvExample(auth: ParsedSpec['auth']): string {
  let content = '# Generated environment variables\n';
  for (const scheme of auth) {
    content += `\n# --- ${scheme.schemeId} (${scheme.type}) ---\n`;
    if (scheme.type === 'oauth2' && scheme.oauth2Flows?.clientCredentials) {
      content += `${scheme.envVarName}_CLIENT_ID=your-client-id\n`;
      content += `${scheme.envVarName}_CLIENT_SECRET=your-client-secret\n`;
    } else if (scheme.type === 'http' && scheme.httpScheme === 'basic') {
      content += `${scheme.envVarName}_USER=your-username\n`;
      content += `${scheme.envVarName}_PASS=your-password\n`;
    } else {
      content += `${scheme.envVarName}=your-${scheme.type}-value-here\n`;
    }
  }
  return content;
}

function generateReadme(title: string, version: string, tools: MappedTool[]): string {
  let content = `# ${title} MCP Server\n\n`;
  content += `Auto-generated MCP server for the ${title} API (v${version}).\n\n`;

  content += `## Setup\n\n`;
  content += '```bash\nnpm install\ncp .env.example .env\nnpm run build\nnpm start\n```\n\n';

  content += `## Available Tools (${tools.length})\n\n`;
  for (const tool of tools.slice(0, 10)) {
    content += `### \`${tool.name}\`\n\n`;
    content += `${tool.description}\n\n`;
  }
  if (tools.length > 10) {
    content += `... and ${tools.length - 10} more tools.\n\n`;
  }

  return content;
}

export async function emitFull(outputDir: string, mapped: MappedSpec, parsed: ParsedSpec): Promise<void> {
  await fs.mkdir(path.join(outputDir, 'src'), { recursive: true });

  const serverName = parsed.info.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-mcp-server';

  // Generate TypeScript source files
  await fs.writeFile(path.join(outputDir, 'src', 'index.ts'), generateIndexModule());
  await fs.writeFile(path.join(outputDir, 'src', 'server.ts'), generateServerModule(parsed.info.title));
  await fs.writeFile(path.join(outputDir, 'src', 'tools.ts'), generateToolsModule(mapped.tools, parsed.auth));
  await fs.writeFile(path.join(outputDir, 'src', 'http.ts'), generateHTTPModule());
  await fs.writeFile(path.join(outputDir, 'src', 'auth.ts'), generateAuthModule());

  // Generate config files
  await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(generatePackageJson(serverName), null, 2));
  await fs.writeFile(path.join(outputDir, 'tsconfig.json'), JSON.stringify(generateTsconfig(), null, 2));
  await fs.writeFile(path.join(outputDir, 'Dockerfile'), generateDockerfile(serverName));
  await fs.writeFile(path.join(outputDir, '.env.example'), generateEnvExample(parsed.auth));
  await fs.writeFile(path.join(outputDir, 'README.md'), generateReadme(parsed.info.title, parsed.info.version, mapped.tools));
  await fs.writeFile(path.join(outputDir, '.gitignore'), 'node_modules/\\ndist/\\n.env\\n*.log\\n');
}

