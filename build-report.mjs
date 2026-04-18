#!/usr/bin/env node
// Aggregate per-server audit JSONs into two reports:
//   - REPORT.md         → public summary (aggregate stats, per-server tool counts, finding counts without specifics)
//   - REPORT-full.md    → private report with evidence and tool names (.gitignored during disclosure window)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const auditsDir = new URL('./reports/audits/', import.meta.url).pathname;

const rows = [];
const allFindings = [];
for (const file of readdirSync(auditsDir).sort()) {
  if (!file.endsWith('.json')) continue;
  const slug = file.replace(/^audit-/, '').replace(/\.json$/, '');
  const d = JSON.parse(readFileSync(join(auditsDir, file), 'utf8'));
  const bySev = d.summary?.bySeverity || {};
  rows.push({
    slug,
    tools: d.server.counts.tools,
    critical: bySev.critical || 0,
    high: bySev.high || 0,
    medium: bySev.medium || 0,
    low: bySev.low || 0,
  });
  for (const f of d.findings || []) {
    allFindings.push({ server: slug, ...f });
  }
}

const total = {
  servers: rows.length,
  tools: rows.reduce((s, r) => s + r.tools, 0),
  critical: rows.reduce((s, r) => s + r.critical, 0),
  high: rows.reduce((s, r) => s + r.high, 0),
  medium: rows.reduce((s, r) => s + r.medium, 0),
  low: rows.reduce((s, r) => s + r.low, 0),
};

const METHODOLOGY = `## Methodology

**Static analysis only.** No untrusted code is executed. For each target repository:

1. Clone the source at a pinned revision
2. Parse TypeScript via the official compiler's AST
3. Extract tool registrations (\`server.tool()\`, \`server.registerTool()\`, or \`ToolDefs\` object-map patterns) into an mcp-audit manifest
4. Run \`mcp-audit scan --manifest\` against the extracted manifest

This is strictly safer than spawning the server to list its tools: no postinstall hooks run, no network calls are made by the target code, and the audit is fully reproducible from source alone.

Rules applied:

| Rule | Severity | Detects |
|---|---|---|
| \`prompt-injection\` | critical | instruction overrides, role redefinition, fake system tags, silent-exfiltration directives in tool descriptions |
| \`invisible-instructions\` | critical | Unicode Tag ("ASCII Smuggler"), zero-width chars, control chars, hidden base64 in descriptions |
| \`unsafe-tool-combos\` | critical/high | "lethal trifecta" capability combinations on one server |
| \`sensitive-output\` | high | tool names implying secret, env var, or credential output |
| \`tool-poisoning\` | high | hidden capabilities, read-only claims contradicted by mutating params |
| \`schema-permissiveness\` | high | unbounded strings on command-shaped surfaces, missing \`inputSchema\` |
| \`unauthenticated-server\` | high | remote (HTTP/SSE) servers with no auth |
| \`destructive-no-confirm\` | medium | destructive ops (\`delete_*\`, \`drop_*\`, \`reset_*\`) with no confirmation parameter |
| \`excessive-scope\` | medium | single server spanning many unrelated capability domains |
`;

// ---- public report (aggregate only) ----
let md = `# MCP Security Sweep

Static security audit of ${total.servers} public MCP servers across ${total.tools} tools, using [\`@dj_abstract/mcp-audit\`](https://www.npmjs.com/package/@dj_abstract/mcp-audit).

${METHODOLOGY}

## Aggregate results

| Metric | Count |
|---|---|
| Servers audited | ${total.servers} |
| Tools audited | ${total.tools} |
| **Critical** findings | ${total.critical} |
| **High** findings | ${total.high} |
| **Medium** findings | ${total.medium} |
| Low findings | ${total.low} |

## Per-server surface

| Server | Tools | C | H | M |
|---|---:|---:|---:|---:|
`;
for (const r of rows.sort((a, b) => b.critical - a.critical || b.high - a.high || b.medium - a.medium || b.tools - a.tools)) {
  md += `| \`${r.slug}\` | ${r.tools} | ${r.critical} | ${r.high} | ${r.medium} |\n`;
}

md += `

## Findings (disclosure-gated)

Specific vulnerability details are withheld until maintainer disclosure windows close.
Each finding has been privately reported to the affected maintainer.

A public follow-up with full evidence will be published after the earliest of:

- 90 days from initial notification, or
- maintainer confirmation that a fix has shipped.

Until then, reproduce with the extractor and \`@dj_abstract/mcp-audit\` — you will find the same issues. The point of this repo is the methodology, not the specific CVEs.

## Reproduce

\`\`\`bash
git clone https://github.com/abregoarthur-star/mcp-audit-sweep.git
cd mcp-audit-sweep
npm install
./scripts/fetch-sources.sh     # clone upstream vendor sources
./scripts/run-sweep.sh         # extract + audit + rebuild REPORT.md
\`\`\`

Runs in under a minute on a laptop. No code from the audited servers is executed.

## Classifier bugs fixed during this sweep

Finding real vulnerabilities is only half the work — knowing that your tool produces false-positive-free output is the other half. Three classifier bugs in \`mcp-audit\` were caught against these real codebases and fixed before the final numbers above:

- \`unsafe-tool-combos\` was matching "file system" in free-text descriptions as shell_exec. Filesystem servers were self-classifying as shell-capable. Fixed by token-based name classification.
- \`excessive-scope\` matched partial substrings ("subscription" in subscriber-management descriptions, "update" in resource-update descriptions). Fixed with the same token approach.
- \`sensitive-output\` \`/keys?$/\` over-matched: \`publishable_keys\` (Supabase's public anon keys, designed to be shared), \`observability_keys\` (metric dimension names), and \`list_ct_logs\` (public Certificate Transparency logs) were all false positives. Tightened to require sensitive qualifiers like \`api_/secret_/private_\` adjacent to \`key\`.

See [\`mcp-audit\` release history](https://github.com/abregoarthur-star/mcp-audit/commits/main) for the fixes.

---

Generated by [\`@dj_abstract/mcp-audit\`](https://www.npmjs.com/package/@dj_abstract/mcp-audit) on ${new Date().toISOString().slice(0, 10)}.
`;

writeFileSync(new URL('./REPORT.md', import.meta.url).pathname, md);

// ---- private report (full evidence) ----
let full = `# MCP Security Sweep — Full Evidence (INTERNAL)

This file is .gitignored. Do not commit. Use it to draft disclosure emails
and to verify re-audit results against prior runs.

`;
full += `Generated: ${new Date().toISOString()}\n\n`;
full += `${total.servers} servers, ${total.tools} tools, ${total.critical}C / ${total.high}H / ${total.medium}M / ${total.low}L findings.\n\n`;

if (allFindings.length === 0) {
  full += `No findings.\n`;
} else {
  const bySeverity = { critical: [], high: [], medium: [], low: [] };
  for (const f of allFindings) (bySeverity[f.severity] || []).push(f);
  for (const sev of ['critical', 'high', 'medium', 'low']) {
    if (bySeverity[sev].length === 0) continue;
    full += `## ${sev.toUpperCase()} (${bySeverity[sev].length})\n\n`;
    for (const f of bySeverity[sev]) {
      full += `### \`${f.server}\` — ${f.ruleId} — \`${f.target?.name || ''}\`\n\n`;
      full += `**${f.title}**\n\n`;
      full += `${f.description}\n\n`;
      if (f.evidence) {
        full += '```json\n' + JSON.stringify(f.evidence, null, 2) + '\n```\n\n';
      }
      if (f.remediation) full += `**Remediation:** ${f.remediation}\n\n`;
      full += '---\n\n';
    }
  }
}

writeFileSync(new URL('./REPORT-full.md', import.meta.url).pathname, full);

console.log(`✓ REPORT.md       (public, aggregate)`);
console.log(`✓ REPORT-full.md  (private, evidence) — .gitignored`);
console.log(`  ${total.servers} servers · ${total.tools} tools · ${total.critical}C / ${total.high}H / ${total.medium}M`);
