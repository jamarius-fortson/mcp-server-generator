# Installation & Verification Checklist

Use this checklist to get the project running from source.

---

## Step 1: Environment Verification

- [ ] Node.js installed: `node --version` (should be 18+)
- [ ] npm installed: `npm --version` (should be 8+)
- [ ] TypeScript accessible: `npx tsc --version`
- [ ] Git installed: `git --version` (for cloning)

```bash
# Run all checks
node --version && npm --version && npx tsc --version
```

---

## Step 2: Project Setup

- [ ] Clone / download mcp-server-generator
- [ ] Navigate to project: `cd mcp-server-generator`
- [ ] Verify key files exist:
  ```bash
  ls -la src/cli/index.ts
  ls -la src/pipeline/parser/index.ts
  ls -la test/fixtures/petstore.yaml
  ls -la package.json
  ```

---

## Step 3: Install Dependencies

### Method A: Standard Install (Recommended)

```bash
npm install
```

**If this hangs**:
- Ctrl+C to cancel
- Try Method B or C below

### Method B: With Legacy Peer Deps Flag

```bash
npm install --legacy-peer-deps
```

**Why**: Handles some transitive dependency conflicts

### Method C: Clear Cache & Retry

```bash
npm cache clean --force
npm install --no-optional
```

### Method D: Use Different npm Registry

```bash
npm install --registry https://registry.npmjs.org/
```

**Expected output**: Should see "added X packages" at the end

---

## Step 4: Verify Installation

After successful npm install:

```bash
# Check node_modules exists
ls node_modules/@modelcontextprotocol/sdk

# Check TypeScript is available
npx tsc --version

# List installed packages
npm list --depth=0
```

**Expected**:
```
├── @apidevtools/swagger-parser
├── @modelcontextprotocol/sdk  
├── commander
├── dotenv
├── js-yaml
├── swagger2openapi
└── zod
```

---

## Step 5: Compile TypeScript

```bash
npm run build
```

**Expected**: Creates `dist/` directory with compiled `.js` files

**If errors occur**:
```bash
# Check TypeScript config
npx tsc --noEmit

# Show specific errors
npx tsc
```

---

## Step 6: Run Tests

```bash
# Single run
npm run test:run

# Or watch mode
npm run test
```

**Expected**: All tests pass

**If tests fail**:
```bash
# Check specific test file
npx vitest test/pipeline/parser.test.ts

# Run with verbose output
npm run test:run -- --reporter=verbose
```

---

## Step 7: Generate Sample Server

```bash
# Generate from test fixture
npx mcp-generate test/fixtures/petstore.yaml --output ./petstore-mcp

# Or use built CLI directly
node dist/cli/index.js generate test/fixtures/petstore.yaml --output ./petstore-sample
```

**Expected**: Creates `petstore-mcp/` or `petstore-sample/` directory

**Verify output**:
```bash
ls -la petstore-mcp/src/
ls -la petstore-mcp/package.json
ls -la petstore-mcp/Dockerfile
```

---

## Step 8: Build Generated Server

```bash
cd petstore-mcp
npm install
npm run build
```

**Expected**: Compiles generated TypeScript → `dist/` directory

**Verify**:
```bash
ls -la dist/index.js
ls -la dist/server.js
```

---

## Step 9: Start Generated Server

```bash
# Copy env template (if needed)
cp .env.example .env

# Start
npm start
```

**Expected**: Server starts and logs to stderr (no errors)

**Example output** (to stderr):
```
MCP server 'petstore-api' started on stdio transport
```

**If auth errors occur**:
- The generated server validates auth at startup
- Most petstore spec endpoints don't require auth
- If you see "Missing required environment variables", check `.env`

---

## Troubleshooting Table

| Issue | Symptom | Solution |
|-------|---------|----------|
| npm install hangs | Spinner forever | Try Method B or C |
| "cannot find module X" | Import error | Run `npm install` again |
| "TypeScript not found" | tsc command fails | Run `npm install` |
| Compilation errors | `npm run build` fails | Check `npx tsc --noEmit` |
| Tests fail | `npm run test:run` fails | Check Node.js version (18+) |
| Generated server fails to start | Startup error | Check `.env` file exists |

---

## Quick Verification Script

Save as `verify.sh` and run:

```bash
#!/bin/bash
set -e

echo "✓ Checking Node.js..."
node --version

echo "✓ Checking npm..."
npm --version

echo "✓ Installing dependencies..."
npm install --legacy-peer-deps

echo "✓ Building generator..."
npm run build

echo "✓ Running tests..."
npm run test:run

echo "✓ Generating sample..."
npx mcp-generate test/fixtures/petstore.yaml --output ./test-output

echo "✓ Building generated server..."
cd test-output
npm install
npm run build

echo "✅ All verifications passed!"
```

Run with:
```bash
bash verify.sh
```

---

## Alternative: Docker Verification

If npm install is problematic on your system, use Docker:

```bash
# Build Docker image
docker build -t mcp-gen .

# Run verification
docker run --rm -v $(pwd):/workspace mcp-gen \
  bash -c "npm install && npm run test:run"
```

---

## Support Resources

- **npm install issues**: https://docs.npmjs.com/troubleshooting/troubleshooting-npm-errors
- **Node.js versions**: https://nodejs.org/en/about/releases/
- **TypeScript setup**: https://www.typescriptlang.org/docs/handbook/typescript-tooling-in-5-minutes.html

---

## Success Criteria

You'll know everything is working when:

1. ✅ `npm run build` compiles without errors
2. ✅ `npm run test:run` shows passing tests
3. ✅ `npm run dev -- test/fixtures/petstore.yaml --output ./test` generates files
4. ✅ Generated server `npm install && npm run build` succeeds
5. ✅ Generated server `npm start` starts without errors

---

**Last Updated**: March 25, 2026  
**Status**: Ready for use
