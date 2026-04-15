# Deployment Guide

This guide covers deploying generated MCP servers to various environments.

## Local Development

### Prerequisites

- Node.js 18+
- npm (for Node.js)

### Setup

```bash
npm install
cp .env.example .env
# Edit .env with your API credentials
npm run build
npm start
```

The server will listen on stdio and print prompt to stderr.

Connect from Claude Desktop by adding to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "node",
      "args": ["/path/to/generated/dist/index.js"],
      "env": {
        "API_KEY": "your-key-here"
      }
    }
  }
}
```

## Docker

### Build

```bash
docker build -t my-api-mcp-server:latest .
```

### Run

```bash
docker run -d \
  --name my-api-mcp \
  --env-file .env \
  -p 3000:3000 \
  my-api-mcp-server:latest
```

For stdio transport, the container must be run `stdin_open: true` in docker-compose or `docker run -it`.

For HTTP transport (if `--transport http` was used during generation):

```bash
# In Dockerfile.http or use --transport http flag:
EXPOSE 3000
ENV TRANSPORT=http PORT=3000
```

Then:

```bash
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  my-api-mcp-server:latest
```

### Docker Compose

```bash
docker-compose up -d
```

See generated `docker-compose.yaml` for configuration.

## Cloud Platforms

### AWS ECS

1. Build and push image to ECR:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag my-api-mcp-server:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/my-api-mcp:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/my-api-mcp:latest
```

2. Create ECS task definition (`task-definition.json`):

```json
{
  "family": "my-api-mcp",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "mcp-server",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/my-api-mcp:latest",
      "environment": [
        { "name": "API_KEY", "value": "..." }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/my-api-mcp",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

3. Register and run:

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
aws ecs run-task --cluster default --task-definition my-api-mcp --launch-type FARGATE
```

### Google Cloud Run

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/my-api-mcp
gcloud run deploy my-api-mcp \
  --image gcr.io/PROJECT_ID/my-api-mcp \
  --port 3000 \
  --set-env-vars API_KEY=... \
  --region us-central1
```

Note: Cloud Run requires HTTP transport (add `--transport http` during generation).

## Environment Variables

All auth credentials must be passed via environment variables. See `.env.example` for required variables.

**Never commit `.env` to version control.**

For production, use:
- Docker: `--env-file` or `docker-compose.yml` with secret management
- Kubernetes: Secrets
- AWS: Systems Manager Parameter Store / Secrets Manager
- GCP: Secret Manager

## Monitoring

The generated server logs to stderr in structured JSON format:

```json
{
  "timestamp": "2026-03-25T10:30:45.123Z",
  "level": "info",
  "tool": "list_users",
  "method": "GET",
  "path": "/users",
  "status": 200,
  "latency_ms": 145
}
```

Logs can be aggregated with:
- Datadog
- Cloudwatch (AWS)
- Stackdriver (GCP)
- ELK Stack
- Loki

Set `LOG_LEVEL` environment variable:

```bash
export LOG_LEVEL=debug  # error, warn, info (default), debug
```

## Performance & Scaling

### Timeouts

- HTTP request timeout: 30 seconds (configurable via `API_TIMEOUT_MS` env var)
- MCP message timeout: depends on client (usually 30-60s)

### Resource Limits

Generated servers typically use:

- **Memory**: 50-100 MB at rest
- **CPU**: <10% idle
- **Startup time**: <500ms

For large APIs (1000+ tools), increase memory allocation:

```bash
# Docker
docker run -m 512m ...

# Kubernetes
memory: "512Mi"

# Node.js
NODE_OPTIONS=--max-old-space-size=512
```

## Security

### API Credentials

- Use strong API keys / tokens
- Rotate credentials regularly
- Never log credentials (server auto-redacts)
- Use short-lived tokens where possible

### Network

- Upstream API calls: encrypted via HTTPS
- MCP connection: depends on transport (stdio is secure, HTTP requires TLS)
- Firewall: restrict to known clients only

### Updates

Generated servers are date-pinned to a specific generator version. To update:

1. Update on a dev/staging instance
2. Test against live API
3. Rebuild Docker image
4. Deploy

## Troubleshooting

### "Missing required environment variables"

Server fails on startup. Copy `.env.example` to `.env` and fill in values.

### "API returned 401"

Authentication failed. Verify credentials in `.env` are correct.

### "Request timeout after 30000ms"

API is slow or unreachable. Check:
- Network connectivity to API base URL
- API status / rate limits
- Increase `API_TIMEOUT_MS` if needed

### "Tool invocation failed"

Check:
- Generated server logs (stderr)
- Upstream API response (server logs it)
- Parameter validation (check tool schema)

## Rollback

Generated servers are stateless. To rollback:

1. Update `.env` if credentials changed
2. Redeploy previous image / version
3. All existing connections will be re-established

No data loss or recovery needed.
