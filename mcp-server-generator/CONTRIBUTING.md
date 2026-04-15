# Contributing Guide

## Code Style

- **Language**: TypeScript 5.0+, strict mode
- **Formatter**: Prettier (see `.prettierrc.json`)
- **Linter**: ESLint (see `.eslintrc.json`)
- **Testing**: Vitest

```bash
npm run lint          # Check
npm run lint -- --fix # Auto-fix
```

## Testing

- Write tests for new features
- Target: >80% code coverage
- Integration tests in `test/integration/`
- Unit tests in `test/unit/`

```bash
npm run test:run      # Run all tests
npm run test          # Watch mode
```

## Architecture Principles

1. **Pipeline stages are pure functions** — they take input, produce output, collect warnings
2. **Errors are values** — use Result types, not exceptions (unless truly exceptional)
3. **Generated code is not clever** — it's readable, maintainable, debuggable
4. **No hardcoded credentials** — everything comes from env vars
5. **Fail fast with clarity** — specific error messages, clear setup instructions

## Key Files to Know

- `src/pipeline/parser/index.ts` — The heart of parsing
- `src/pipeline/mapper/index.ts` — Endpoint → Tool conversion logic
- `src/pipeline/emitter/index.ts` — Generated code templates
- `test/fixtures/petstore.yaml` — Main test spec

## Common Tasks

### Add a New OpenAPI Feature

1. Extend `ParsedSpec` types in `src/pipeline/parser/types.ts`
2. Parse in `src/pipeline/parser/index.ts` → `normalizeSchema()` / `extractEndpoints()`
3. Map in `src/pipeline/mapper/index.ts`
4. Write test in `test/unit/parser.test.ts`

### Add a New Auth Pattern

1. Add to `AuthConfig` type in `src/pipeline/parser/types.ts`
2. Detect in `mapSecuritySchemes()` in `src/pipeline/parser/index.ts`
3. Inject in generated `src/auth.ts` (in emitter)
4. Test with fixture

### Improve Description Optimizer

1. Add compression logic to `src/pipeline/optimizer/index.ts`
2. Track token counts in `src/utils/tokens.ts` (if needed)
3. Test with real specs in `test/integration/`
4. Aim for 80% reduction in description length without losing meaning

## Pull Request Checklist

- [ ] Tests pass (`npm run test:run`)
- [ ] Linting passes (`npm run lint`)
- [ ] Types compile (`npx tsc --noEmit`)
- [ ] New features have tests
- [ ] Generated code produces valid MCP servers
- [ ] Updated README/CONTRIBUTING if needed

## Troubleshooting

### "Missing required environment variable"

The generated server validates all auth credentials at startup. Copy `.env.example` to `.env` and fill in your actual values.

### "Invalid schema" errors

Check the OpenAPI spec against the official validator. Real-world specs often have issues; our parser handles them gracefully but logs warnings.

### Generated TypeScript doesn't compile

This is a bug. Report with the spec that caused it.

## Questions?

Check existing issues / discussions. If you find a gap, open an issue describing the spec that doesn't work as expected.
