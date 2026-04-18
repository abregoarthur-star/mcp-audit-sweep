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


## Aggregate results

| Metric | Count |
|---|---|
| Servers audited | 30 |
| Tools audited | 184 |
| **Critical** findings | 0 |
| **High** findings | 1 |
| **Medium** findings | 5 |
| Low findings | 0 |

## Per-server surface

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
