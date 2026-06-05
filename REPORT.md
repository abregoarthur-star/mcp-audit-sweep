# MCP Security Sweep

Static security audit of 30 public MCP servers across 184 tools, using [`@dj_abstract/mcp-audit`](https://www.npmjs.com/package/@dj_abstract/mcp-audit).

## Methodology

**Static analysis only.** No untrusted code is executed. For each target repository:

1. Clone the source at a pinned revision
2. Parse TypeScript via the official compiler's AST
3. Extract tool registrations (`server.tool()`, `server.registerTool()`, or `ToolDefs` object-map patterns) into an mcp-audit manifest
4. Run `mcp-audit scan --manifest` against the extracted manifest

This is strictly safer than spawning the server to list its tools: no postinstall hooks run, no network calls are made by the target code, and the audit is fully reproducible from source alone.

Rules applied:

| Rule | Severity | Detects |
|---|---|---|
| `prompt-injection` | critical | instruction overrides, role redefinition, fake system tags, silent-exfiltration directives in tool descriptions |
| `invisible-instructions` | critical | Unicode Tag ("ASCII Smuggler"), zero-width chars, control chars, hidden base64 in descriptions |
| `unsafe-tool-combos` | critical/high | "lethal trifecta" capability combinations on one server |
| `sensitive-output` | high | tool names implying secret, env var, or credential output |
| `tool-poisoning` | high | hidden capabilities, read-only claims contradicted by mutating params |
| `schema-permissiveness` | high | unbounded strings on command-shaped surfaces, missing `inputSchema` |
| `unauthenticated-server` | high | remote (HTTP/SSE) servers with no auth |
| `destructive-no-confirm` | medium | destructive ops (`delete_*`, `drop_*`, `reset_*`) with no confirmation parameter |
| `excessive-scope` | medium | single server spanning many unrelated capability domains |


## Aggregate results — Round 1 (2026-04-18)

| Metric | Count |
|---|---|
| Servers audited | 30 |
| Tools audited | 184 |
| **Critical** findings | 0 |
| **High** findings | 1 |
| **Medium** findings | 5 |
| Low findings | 0 |

## Aggregate results — Round 2 (2026-06-04)

Six additional MCP servers spanning a different vendor mix: a major cloud platform, a Microsoft developer-infrastructure surface, search & retrieval, and Hugging Face. Selection focused on TS-AST-extractable servers with permissive licenses and active commit history. See `scripts/fetch-round-2.sh` for the pinned commit list.

| Metric | Count |
|---|---|
| Servers audited | 6 |
| Tools audited | 145 |
| **Critical** findings | 0 |
| **High** findings | 2 |
| **Medium** findings | 1 |
| Low findings | 0 |

Round 2 findings are tracked in [`DISCLOSURE.md`](./DISCLOSURE.md) as `MCP-SWEEP-007..009` and are currently in **Queued** status pending maintainer notification.

### Two ecosystem observations from Round 2

Worth flagging publicly even before the per-finding disclosure windows close:

1. **Remote-MCP proxy shells.** Several high-profile vendors (Stripe, Atlassian, Neon, Notion) now ship their MCP server as a thin proxy that fetches its tool list from `mcp.<vendor>.com` at runtime. The published repo has no tool source code to audit. Static analysis is impossible by design — the agent surface is unknowable until runtime. This pattern shifts the entire audit problem to the remote endpoint, which may or may not be inspectable by customers.
2. **Language fragmentation.** The most-popular Slack, GitHub, AWS, Grafana, Elasticsearch, and Atlassian MCP servers are written in Python, Go, or Rust — none of which the current TS-AST extractor walks. A Python-AST extension would unlock 3–4 additional high-stakes audit targets in the next round.

## Per-server surface — Round 1 (2026-04-18)

| Server | Tools | C | H | M |
|---|---:|---:|---:|---:|
| `everything` | 17 | 0 | 1 | 0 |
| `memory` | 9 | 0 | 0 | 3 |
| `sb-branching-tools` | 6 | 0 | 0 | 2 |
| `cf-radar` | 66 | 0 | 0 | 0 |
| `filesystem` | 14 | 0 | 0 | 0 |
| `sb-account-tools` | 9 | 0 | 0 | 0 |
| `cf-graphql` | 6 | 0 | 0 | 0 |
| `cf-ai-gateway` | 5 | 0 | 0 | 0 |
| `cf-common-d1` | 5 | 0 | 0 | 0 |
| `cf-common-kv_namespace` | 5 | 0 | 0 | 0 |
| `sb-database-operation-tools` | 5 | 0 | 0 | 0 |
| `cf-common-hyperdrive` | 4 | 0 | 0 | 0 |
| `cf-common-r2_bucket` | 4 | 0 | 0 | 0 |
| `cf-browser-rendering` | 3 | 0 | 0 | 0 |
| `cf-workers-observability` | 3 | 0 | 0 | 0 |
| `sb-development-tools` | 3 | 0 | 0 | 0 |
| `sb-edge-function-tools` | 3 | 0 | 0 | 0 |
| `sb-storage-tools` | 3 | 0 | 0 | 0 |
| `cf-common-account` | 2 | 0 | 0 | 0 |
| `cf-common-docs-ai-search` | 2 | 0 | 0 | 0 |
| `cf-common-docs-vectorize` | 2 | 0 | 0 | 0 |
| `cf-common-worker` | 2 | 0 | 0 | 0 |
| `cf-common-zone` | 2 | 0 | 0 | 0 |
| `sb-debugging-tools` | 2 | 0 | 0 | 0 |
| `cf-docs-autorag` | 1 | 0 | 0 | 0 |
| `sequentialthinking` | 1 | 0 | 0 | 0 |
| `cf-workers-bindings` | 0 | 0 | 0 | 0 |
| `mcp-server-postgrest` | 0 | 0 | 0 | 0 |
| `mcp-server-supabase` | 0 | 0 | 0 | 0 |
| `sb-docs-tools` | 0 | 0 | 0 | 0 |


## Per-server surface — Round 2 (2026-06-04)

| Server | Tools | C | H | M |
|---|---:|---:|---:|---:|
| `azure-devops-mcp` | 91 | 0 | 1 | 1 |
| `heroku-mcp` | 38 | 0 | 1 | 0 |
| `exa-mcp` | 8 | 0 | 0 | 0 |
| `brave-search-mcp` | 6 | 0 | 0 | 0 |
| `context7-mcp` | 2 | 0 | 0 | 0 |
| `hf-mcp` | 0* | 0 | 0 | 0 |

*Hugging Face uses a `*_TOOL_CONFIG` per-file constant pattern the current TS-AST extractor doesn't walk. Extractor patch will reattempt this server in a follow-up.

## Findings (disclosure-gated)

Specific vulnerability details are withheld until maintainer disclosure windows close.
Each finding has been privately reported to the affected maintainer.

A public follow-up with full evidence will be published after the earliest of:

- 90 days from initial notification, or
- maintainer confirmation that a fix has shipped.

Until then, reproduce with the extractor and `@dj_abstract/mcp-audit` — you will find the same issues. The point of this repo is the methodology, not the specific CVEs.

## Reproduce

```bash
git clone https://github.com/abregoarthur-star/mcp-audit-sweep.git
cd mcp-audit-sweep
npm install
./scripts/fetch-sources.sh     # clone upstream vendor sources
./scripts/run-sweep.sh         # extract + audit + rebuild REPORT.md
```

Runs in under a minute on a laptop. No code from the audited servers is executed.

## Classifier bugs fixed during this sweep

Finding real vulnerabilities is only half the work — knowing that your tool produces false-positive-free output is the other half. Three classifier bugs in `mcp-audit` were caught against these real codebases and fixed before the final numbers above:

- `unsafe-tool-combos` was matching "file system" in free-text descriptions as shell_exec. Filesystem servers were self-classifying as shell-capable. Fixed by token-based name classification.
- `excessive-scope` matched partial substrings ("subscription" in subscriber-management descriptions, "update" in resource-update descriptions). Fixed with the same token approach.
- `sensitive-output` `/keys?$/` over-matched: `publishable_keys` (Supabase's public anon keys, designed to be shared), `observability_keys` (metric dimension names), and `list_ct_logs` (public Certificate Transparency logs) were all false positives. Tightened to require sensitive qualifiers like `api_/secret_/private_` adjacent to `key`.

See [`mcp-audit` release history](https://github.com/abregoarthur-star/mcp-audit/commits/main) for the fixes.

---

Generated by [`@dj_abstract/mcp-audit`](https://www.npmjs.com/package/@dj_abstract/mcp-audit) on 2026-04-18.
