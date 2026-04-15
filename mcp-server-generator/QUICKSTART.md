# Quick Start Guide

## Installation & Setup (5 minutes)

### Prerequisites

- Node.js 18.x or higher
- npm 8.x or higher

### Install & Build

```bash
# Clone or download the mcp-server-generator repository
cd mcp-server-generator

# Install dependencies (may take 2-3 minutes)
npm install --legacy-peer-deps

# Compile TypeScript
npm run build

# Verify installation
npm list | head -20
```

### Test Installation

```bash
# Run unit tests
npm run test:run

# Or generate a sample server from petstore
npm run dev -- test/fixtures/petstore.yaml --output ./my-first-mcp-server
cd my-first-mcp-server
npm install
npm run build
npm start
```

---

## Usage Examples

### Generate from URL

```bash
# From a public OpenAPI spec
npx mcp-generate https://petstore.swagger.io/v2/swagger.json --output ./petstore-mcp

# Or from a file
npx mcp-generate ./my-api.yaml --output ./my-api-mcp-server
```

### Generate with Options

```bash
# Specify custom server name
npx mcp-generate ./api.json --name my-api-server

# Resource grouping (default) or individual tools
npx mcp-generate ./api.json --mode resource

# Include deprecated endpoints
npx mcp-generate ./api.json --include-deprecated

# Skip authentication (for public APIs)
npx mcp-generate ./api.json --skip-auth
```

---

## Generated Server Workflow

```bash
# 1. Generate from OpenAPI spec
npx mcp-generate https://api.example.com/openapi.json

# 2. Enter the generated directory
cd ./mcp-server-output

# 3. Install dependencies
npm install

# 4. Copy environment template and fill in credentials
cp .env.example .env
# Edit .env with your API key/token

# 5. Build
npm run build

# 6. Start the server (stdio transport for Claude Desktop)
npm start

# Or with Docker
# docker build -t my-api-mcp .
# docker run --env-file .env my-api-mcp
```

---

## Connecting to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "node",
      "args": ["/absolute/path/to/generated/dist/index.js"],
      "env": {
        "API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Then restart Claude Desktop and the MCP server will be available to Claude.

---

## Troubleshooting

### npm install hangs or times out

```bash
# Try with legacy peer deps flag
npm install --no-fund --legacy-peer-deps

# Or clear npm cache
npm cache clean --force
npm install
```

### "Missing required environment variables"

The generated server validates all auth credentials at startup. Make sure `.env` exists and has all required variables listed in `.env.example`.

```bash
# Check what's required
cat .env.example

# Create and fill in .env
cp .env.example .env
nano .env  # or your editor
```

### TypeScript compilation errors in generated server

Rare, but if it happens:

```bash
# Ensure strict TypeScript is working
npm run build -- --noEmit

# Check tsconfig.json is valid
npx ts-node -e "console.log('TypeScript OK')"
```

### HTTP timeout errors

The generated server has 30-second timeout by default. For slow APIs, increase:

```bash
# In generated server's .env
API_TIMEOUT_MS=60000
```

---

## Development Commands

### For Generator Contributors

```bash
# Watch mode (rebuilds on file change)
npm run dev -- ./test/fixtures/petstore.yaml

# Run tests in watch mode
npm run test

# Check code quality
npm run lint

# Fix formatting
npm run lint -- --fix
```

---

## Project Structure

```
mcp-server-generator/
├── src/
│   ├── cli/              # Command-line interface
│   ├── pipeline/         # OpenAPI parsing → MCP generation
│   ├── auth/             # Auth injection
│   ├── http/             # HTTP client  
│   └── utils/            # Utilities
├── test/
│   ├── fixtures/         # Test OpenAPI specs
│   ├── integration/      # End-to-end tests
│   └── pipeline/         # Unit tests
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── README.md             # Full documentation
```

---

## What Gets Generated

When you run `mcp-generate`, you get a complete project with:

```
generated-server/
├── src/
│   ├── index.ts          # Entry point
│   ├── server.ts         # MCP server setup
│   ├── tools.ts          # Tool handlers
│   ├── http.ts           # HTTP client
│   ├── auth.ts           # Auth injection
│   └── config.ts         # Config validation
├── package.json          # Minimal deps (MCP SDK + dotenv)
├── tsconfig.json         # TypeScript config
├── Dockerfile            # Production Docker image
├── docker-compose.yaml   # Quick-start Docker
├── .env.example          # Required credentials
├── README.md             # Generated documentation
├── .gitignore
└── dist/                 # Compiled output (created by npm run build)
```

---

## Next Steps

1. **Generate your first server**: Pick an OpenAPI spec you want to expose
2. **Test locally**: Run the generated server and invoke tools
3. **Deploy**: Use Docker or deploy to cloud (AWS, GCP, etc.)
4. **Connect to Claude**: Add to Claude Desktop config and start using

---

## Support & Issues

- Check [CONTRIBUTING.md](./CONTRIBUTING.md) for development
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for cloud deployment
- Read [ROADMAP.md](./ROADMAP.md) for planned features
- Report issues on GitHub

---

## Performance Notes

- **Generation speed**: <30 seconds for 500+ endpoint specs
- **Generated server memory**: 50-100 MB at rest
- **Tool invocation overhead**: <10ms (excluding API latency)
- **Startup time**: <500ms

---

Happy generating! 🚀
