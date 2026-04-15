export class HttpClient {
  private baseUrl: string;
  private defaultTimeout = 30_000;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
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
  ): Promise<{ status: number; data: unknown; headers: Record<string, string> }> {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.baseUrl);

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

    const timeout = options?.timeout ?? this.defaultTimeout;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url.toString(), {
        method: method.toUpperCase(),
        headers,
        body,
        signal: controller.signal
      });

      const contentType = response.headers.get('content-type') ?? '';
      let data: unknown;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        responseHeaders[k] = v;
      });

      return {
        status: response.status,
        data,
        headers: responseHeaders
      };
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
