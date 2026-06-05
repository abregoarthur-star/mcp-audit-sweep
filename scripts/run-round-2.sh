#!/usr/bin/env bash
# Round 2 sweep pipeline: extract manifests + audit + aggregate Round 2 results.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d round-2-sources ]; then
  echo "Round 2 sources missing. Run scripts/fetch-round-2.sh first." >&2
  exit 1
fi

mkdir -p reports/round-2/audits

# name | subpath  (subpath relative to round-2-sources/<name>)
TARGETS=(
  "heroku-mcp|src"
  "azure-devops-mcp|src"
  "exa-mcp|src"
  "brave-search-mcp|src"
  "context7-mcp|packages/mcp/src"
  "hf-mcp|packages/mcp/src"
)

echo "→ Extracting manifests"
for entry in "${TARGETS[@]}"; do
  IFS='|' read -r name subpath <<<"$entry"
  src="round-2-sources/$name/$subpath"
  out="reports/round-2/manifest-$name.json"
  if [ ! -d "$src" ]; then
    echo "  ! $name — source path missing: $src"
    continue
  fi
  node extract-manifest.mjs "$src" "$name" "$out" 2>&1 | tail -1
done

echo "→ Auditing every manifest"
for m in reports/round-2/manifest-*.json; do
  slug=$(basename "$m" .json | sed 's/^manifest-//')
  out="reports/round-2/audits/audit-$slug.json"
  npx @dj_abstract/mcp-audit scan --manifest "$m" --json "$out" --quiet > /dev/null 2>&1 || true
done

echo "→ Round 2 aggregation"
node -e "
const fs = require('fs');
const path = require('path');
const dir = 'reports/round-2/audits';
const rows = [];
const allFindings = [];
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.json')) continue;
  const slug = f.replace(/^audit-/,'').replace(/\.json$/,'');
  const d = JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
  const bySev = d.summary?.bySeverity || {};
  rows.push({
    slug,
    tools: d.server?.counts?.tools ?? 0,
    critical: bySev.critical || 0,
    high: bySev.high || 0,
    medium: bySev.medium || 0,
    low: bySev.low || 0,
  });
  for (const x of (d.findings||[])) allFindings.push({server: slug, ruleId: x.ruleId, severity: x.severity, title: x.title});
}
const total = rows.reduce((a,r)=>({servers:a.servers+1,tools:a.tools+r.tools,critical:a.critical+r.critical,high:a.high+r.high,medium:a.medium+r.medium,low:a.low+r.low}), {servers:0,tools:0,critical:0,high:0,medium:0,low:0});
console.log('');
console.log('=== Round 2 aggregate ===');
console.log(\`Servers: \${total.servers} · Tools: \${total.tools}\`);
console.log(\`Findings: critical=\${total.critical} high=\${total.high} medium=\${total.medium} low=\${total.low}\`);
console.log('');
console.log('Per-server:');
for (const r of rows) {
  console.log(\`  \${r.slug.padEnd(22)} tools=\${String(r.tools).padStart(3)}  C:\${r.critical} H:\${r.high} M:\${r.medium} L:\${r.low}\`);
}
console.log('');
if (allFindings.length) {
  console.log('All findings (rule × severity × title):');
  for (const f of allFindings) {
    console.log(\`  [\${f.severity}] \${f.server} :: \${f.ruleId} — \${f.title.slice(0,80)}\`);
  }
} else {
  console.log('No findings.');
}
fs.writeFileSync('reports/round-2/SUMMARY.json', JSON.stringify({ asOf:new Date().toISOString(), aggregate: total, rows, findings: allFindings }, null, 2));
console.log('');
console.log('Wrote reports/round-2/SUMMARY.json');
"
