#!/usr/bin/env bash
# Re-clone upstream MCP server sources at their current main branch.
# Run this to reproduce the extraction + audit pipeline locally.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Anthropic reference servers"
[ -d servers ] || git clone --depth 1 https://github.com/modelcontextprotocol/servers.git

echo "→ Cloudflare MCP platform"
[ -d cf-mcp ] || git clone --depth 1 https://github.com/cloudflare/mcp-server-cloudflare.git cf-mcp

echo "→ Supabase MCP"
[ -d sb-mcp ] || git clone --depth 1 https://github.com/supabase-community/supabase-mcp.git sb-mcp

echo "✓ Sources ready"
