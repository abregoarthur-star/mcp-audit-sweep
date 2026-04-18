#!/usr/bin/env bash
# Full sweep pipeline: extract manifests from vendor sources, audit each,
# and regenerate the aggregate REPORT.md.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d servers ] || [ ! -d cf-mcp ] || [ ! -d sb-mcp ]; then
  echo "Sources missing. Run scripts/fetch-sources.sh first." >&2
  exit 1
fi

mkdir -p reports/audits

echo "→ Extracting Anthropic reference servers"
for srv in everything memory sequentialthinking filesystem; do
  node extract-manifest.mjs "servers/src/$srv" "mcp-$srv" "reports/manifest-$srv.json" 2>&1 | tail -1
done

echo "→ Extracting Cloudflare per-app tool files"
for srv in workers-observability radar browser-rendering docs-autorag graphql ai-gateway; do
  node extract-manifest.mjs "cf-mcp/apps/$srv" "cf-$srv" "reports/manifest-cf-$srv.json" 2>&1 | tail -1
done
for f in cf-mcp/packages/mcp-common/src/tools/*.tools.ts; do
  slug=$(basename "$f" .tools.ts)
  node extract-manifest.mjs "$f" "cf-mcp-common-$slug" "reports/manifest-cf-common-$slug.json" 2>&1 | tail -1
done

echo "→ Extracting Supabase tool files"
for f in sb-mcp/packages/mcp-server-supabase/src/tools/*-tools.ts; do
  slug=$(basename "$f" .ts)
  node extract-manifest.mjs "$f" "sb-$slug" "reports/manifest-sb-$slug.json" 2>&1 | tail -1
done

echo "→ Auditing every manifest"
for m in reports/manifest-*.json; do
  slug=$(basename "$m" .json | sed 's/^manifest-//')
  npx @dj_abstract/mcp-audit scan --manifest "$m" --json "reports/audits/audit-$slug.json" --quiet > /dev/null 2>&1 || true
done

echo "→ Aggregating report"
node build-report.mjs

echo "✓ Done — see REPORT.md"
