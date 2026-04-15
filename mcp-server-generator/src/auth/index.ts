import type { AuthConfig } from '../pipeline/parser/types.js';

export function getEnvVar(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

export function injectApiKeyAuth(
  headers: Record<string, string>,
  query: URLSearchParams,
  scheme: AuthConfig
): void {
  if (scheme.type !== 'apiKey' || !scheme.apiKeyName) {
    return;
  }

  const apiKey = getEnvVar(scheme.envVarName);

  if (scheme.apiKeyIn === 'header') {
    headers[scheme.apiKeyName] = apiKey;
  } else if (scheme.apiKeyIn === 'query') {
    query.set(scheme.apiKeyName, apiKey);
  }
}

export function injectBearerAuth(headers: Record<string, string>, scheme: AuthConfig): void {
  if (scheme.type !== 'http' || scheme.httpScheme !== 'bearer') {
    return;
  }

  const token = getEnvVar(scheme.envVarName);
  headers['Authorization'] = `Bearer ${token}`;
}

export function injectBasicAuth(headers: Record<string, string>, scheme: AuthConfig): void {
  if (scheme.type !== 'http' || scheme.httpScheme !== 'basic') {
    return;
  }

  const username = getEnvVar(scheme.envVarName + '_USERNAME');
  const password = getEnvVar(scheme.envVarName + '_PASSWORD');
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  headers['Authorization'] = `Basic ${encoded}`;
}

let cachedOAuth2Token: { value: string; expiresAt: number } | null = null;

export async function injectOAuth2Auth(headers: Record<string, string>, scheme: AuthConfig): Promise<void> {
  if (scheme.type !== 'oauth2' || !scheme.oauth2Flows?.clientCredentials) {
    return;
  }

  const clientId = getEnvVar(scheme.envVarName + '_CLIENT_ID');
  const clientSecret = getEnvVar(scheme.envVarName + '_CLIENT_SECRET');
  const tokenUrl = scheme.oauth2Flows.clientCredentials.tokenUrl;

  if (cachedOAuth2Token && cachedOAuth2Token.expiresAt > Date.now() + 60_000) {
    headers['Authorization'] = `Bearer ${cachedOAuth2Token.value}`;
    return;
  }

  const formData = new URLSearchParams();
  formData.set('grant_type', 'client_credentials');
  formData.set('client_id', clientId);
  formData.set('client_secret', clientSecret);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });

  if (!response.ok) {
    throw new Error(`OAuth2 token request failed: ${response.status}`);
  }

  const tokenData = (await response.json()) as { access_token: string; expires_in: number };
  cachedOAuth2Token = {
    value: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000
  };

  headers['Authorization'] = `Bearer ${tokenData.access_token}`;
}

export async function applyAuth(
  headers: Record<string, string>,
  query: URLSearchParams,
  schemes: AuthConfig[]
): Promise<void> {
  for (const scheme of schemes) {
    if (scheme.type === 'apiKey') {
      injectApiKeyAuth(headers, query, scheme);
    } else if (scheme.type === 'http') {
      if (scheme.httpScheme === 'bearer') {
        injectBearerAuth(headers, scheme);
      } else if (scheme.httpScheme === 'basic') {
        injectBasicAuth(headers, scheme);
      }
    } else if (scheme.type === 'oauth2') {
      await injectOAuth2Auth(headers, scheme);
    }
  }
}
