#!/usr/bin/env bash
# Round 2 sweep: clone Tier 1 candidates at pinned SHAs into round-2-sources/.
# Pinned SHAs come from .agents/round-2-candidates.json (Agent H research).
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p round-2-sources

# name | repo | pinned-sha | subpath
TARGETS=(
  "heroku-mcp|https://github.com/heroku/heroku-mcp-server.git|f8c5dba0d55b5854e54335e53045e196d854fc2d|src"
  "azure-devops-mcp|https://github.com/microsoft/azure-devops-mcp.git|1ba5404829e4d146f21c8b7f96878ca3a6f5c26b|src"
  "exa-mcp|https://github.com/exa-labs/exa-mcp-server.git|0cfbeed65d1f898e9e4ab192d69eb979f363d6d9|src"
  "brave-search-mcp|https://github.com/brave/brave-search-mcp-server.git|ba5419076f36108eddbe42805b683199734a4cbd|src"
  "context7-mcp|https://github.com/upstash/context7.git|fd12465b9ba9565bf17de4eca4ba68197fc74044|packages/mcp/src"
  "hf-mcp|https://github.com/huggingface/hf-mcp-server.git|f080a061dcc6ae0fc8e27ca0f9467cf2ac59a99a|packages/mcp/src"
)

for entry in "${TARGETS[@]}"; do
  IFS='|' read -r name repo sha _subpath <<<"$entry"
  dir="round-2-sources/$name"
  if [ -d "$dir/.git" ]; then
    echo "✓ $name already cloned"
    continue
  fi
  echo "→ cloning $name @ $sha"
  git clone --filter=blob:none "$repo" "$dir"
  git -C "$dir" checkout "$sha"
done

echo "✓ Round 2 sources ready under round-2-sources/"
