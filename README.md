# mcp-audit-sweep

[![Sweep status](https://img.shields.io/badge/servers-30-blue.svg)](./REPORT.md)
[![Tools audited](https://img.shields.io/badge/tools-184-blue.svg)](./REPORT.md)
[![Powered by mcp-audit](https://img.shields.io/badge/powered%20by-%40dj__abstract%2Fmcp--audit-cb3837?logo=npm)](https://www.npmjs.com/package/@dj_abstract/mcp-audit)

Reproducible static security audit of public **Model Context Protocol** servers. Uses [`@dj_abstract/mcp-audit`](https://www.npmjs.com/package/@dj_abstract/mcp-audit) to check tool definitions for prompt injection, tool poisoning, unsafe capability combinations, sensitive-output leakage, and other AI-native security issues.

**Results:** [REPORT.md](./REPORT.md) — 30 servers, 184 tools, aggregate counts.
Specific finding evidence is held pending responsible disclosure to maintainers.

## Why

MCP servers ship arbitrary text directly into the host LLM's context. A malicious or sloppy server can steer any agent that connects to it. As the ecosystem grows, so does the attack surface — and there's almost nothing focused on the security threats unique to agent infrastructure.

This repo runs a systematic sweep of widely-deployed public MCP servers, using a static analyzer that never executes the target code. The goal is to make this kind of sweep a standard check across the MCP ecosystem, not a one-off exercise.

## Scope (current sweep)

| Vendor | Source | Servers / tool modules |
|---|---|---|
| Anthropic MCP reference | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | everything, filesystem, memory, sequentialthinking |
| Cloudflare | [cloudflare/mcp-server-cloudflare](https://github.com/cloudflare/mcp-server-cloudflare) | radar, workers-bindings, workers-observability, browser-rendering, ai-gateway, graphql, docs-autorag, and shared tool modules (d1, kv, r2, hyperdrive, worker, zone, account, docs-ai-search, docs-vectorize) |
| Supabase | [supabase-community/supabase-mcp](https://github.com/supabase-community/supabase-mcp) | mcp-server-supabase, mcp-server-postgrest, plus per-domain tool modules (account, branching, database-operation, debugging, development, docs, edge-function, storage) |

Expanding to GitHub, Notion, Linear, Figma, and the Python reference servers (fetch/git/time) in subsequent sweeps.

## How it works

```
┌──────────────────────┐     ┌─────────────────────┐     ┌───────────────────┐
│  Upstream vendor src │────▶│  AST extractor      │────▶│  Manifest JSONs   │
│  (cloned shallow)    │     │  (TypeScript API)   │     │  (tools + descs)  │
└──────────────────────┘     └─────────────────────┘     └─────────┬─────────┘
                                                                   │
                                                                   ▼
                                                         ┌───────────────────┐
                                                         │  @dj_abstract/    │
                                                         │  mcp-audit scan   │
                                                         │  --manifest       │
                                                         └─────────┬─────────┘
                                                                   │
                                                                   ▼
                                                         ┌───────────────────┐
                                                         │  Per-server       │
                                                         │  findings JSON    │
                                                         └─────────┬─────────┘
                                                                   │
                                                                   ▼
                                                         ┌───────────────────┐
                                                         │  REPORT.md        │
                                                         │  (aggregate)      │
                                                         └───────────────────┘
```

The extractor (`extract-manifest.mjs`) parses TypeScript source via the official compiler API and recognizes three tool-registration patterns used across the ecosystem:

1. `server.registerTool(name, { description, inputSchema, ... }, handler)` — MCP SDK modern
2. `server.tool(name, description, inputSchema, handler)` — MCP SDK legacy / Cloudflare style
3. `const xToolDefs = { name1: { description, ... }, name2: ... } satisfies ToolDefs` — Supabase style

Simple local const and property-access resolution is included, so tools declared as `HYPERDRIVE_TOOLS.configs_list` or split-file config constants are captured.

## Reproduce

```bash
git clone https://github.com/abregoarthur-star/mcp-audit-sweep.git
cd mcp-audit-sweep
npm install
./scripts/fetch-sources.sh     # shallow-clone upstream vendor repos
./scripts/run-sweep.sh         # extract + audit + rebuild REPORT.md
```

Runs in under a minute on a laptop. No code from the audited servers is executed.

## What's public / what's not

**Public in this repo:**
- The full methodology
- The AST extractor source
- Per-server manifest counts and aggregate finding counts
- Classifier bug reports from the sweep and their fixes

**Held for disclosure:**
- Specific tool names + evidence for each finding
- Exploitation context

The private `REPORT-full.md` with per-finding evidence is `.gitignored` and lives only on the author's machine until disclosure windows close.

## License

MIT — see [LICENSE](./LICENSE).

## See also

- [`@dj_abstract/mcp-audit`](https://www.npmjs.com/package/@dj_abstract/mcp-audit) — the auditor itself
- [`abregoarthur-star/mcp-audit`](https://github.com/abregoarthur-star/mcp-audit) — auditor source
- [`abregoarthur-star/prompt-eval`](https://github.com/abregoarthur-star/prompt-eval) — companion runtime prompt-injection eval harness
