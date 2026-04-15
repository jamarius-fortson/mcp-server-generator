# Roadmap

## v0.1.0 (Current / MVP)

- [x] OpenAPI 3.0 parsing
- [x] Swagger 2.0 conversion
- [x] Endpoint extraction + normalization
- [x] Authentication schemes (API key, Bearer, Basic)
- [x] Tool mapping (endpoint → MCP tool name + schema)
- [x] TypeScript code generation
- [x] HTTP client with retry/timeout
- [x] MCP server skeleton generation
- [x] CLI with basic options
- [x] Unit tests (parser, mapper)
- [x] Integration tests (end-to-end)

## v0.2.0 (Q2 2026)

- [ ] OAuth2 full implementation (authorization code flow)
- [ ] Description optimizer (LLM-efficient compression)
- [ ] Custom tool grouping configs
- [ ] Endpoint priority scoring
- [ ] Request/response example injection
- [ ] Generated server Docker build verification
- [ ] HTTP transport (SSE) support
- [ ] More comprehensive test fixtures

## v0.3.0 (Q2/Q3 2026)

- [ ] WebSocket transport support
- [ ] Streaming response handling
- [ ] File upload/download endpoints
- [ ] Batch operation support
- [ ] Server metrics / observability (Prometheus format)
- [ ] Configuration file support (.mcpgen.config.json)
- [ ] Plugin system for custom code generation
- [ ] LLM evaluation tests (function call accuracy)

## v1.0.0 (Q3 2026)

- [ ] Stable CLI with frozen options
- [ ] Comprehensive error recovery
- [ ] Production-grade logging (structured JSON, configurable)
- [ ] Performance benchmarks (Cloudflare-scale spec <60s)
- [ ] Official npm package publication
- [ ] Documentation site (nextra / docusaurus)

## Long-Term

- [ ] Support for OpenAPI 4.0 (when released)
- [ ] gRPC spec support (potential)
- [ ] GraphQL schema support (potential)
- [ ] Multi-language code generation (Go, Python, Rust)
- [ ] IDE extensions (VS Code, JetBrains)
- [ ] SaaS hosted generator (web UI)

## Known Limitations (for documentation)

- **Streaming**: Current HTTP client doesn't support streaming responses
- **Complex Auth**: OAuth2 authorization code flow only partially supported
- **File Uploads**: multipart/form-data endpoints need manual configuration
- **WebSockets**: Not yet supported by MCP spec (at v1.0)
- **Rate Limiting**: No per-tool rate limit enforcement (API handles it)

## Performance Optimization Ideas

- Stream parsing for massive specs (>10MB)
- Parallel endpoint processing
- Schema caching across runs
- Incremental generation (only regenerate changed endpoints)

## Testing Strategy

### Current

- Unit tests: parser, mapper, optimizer
- Integration tests: full pipeline
- Test fixtures: petstore (basic), complex-auth, messy-spec

### Planned

- E2E tests: start generated server, make actual requests
- LLM tests: feed tools to Claude, verify correct tool selection
- Real-world spec test suite (GitHub API, Stripe API, OpenAI API)
- Snapshot tests: ensure generated code doesn't change unexpectedly
- Performance benchmarks: spec parsing throughput

## Community

Initial focus: stability and core completeness. Later will accept PRs for:
- New auth patterns
- New OpenAPI features
- Generated code quality improvements
- Test coverage
- Documentation

File issues for bugs, questions. Feature requests welcome but will be triaged against the roadmap.
