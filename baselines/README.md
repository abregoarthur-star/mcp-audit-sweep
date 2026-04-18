# Baselines — structural snapshots for rug-pull detection

Each subdirectory is a point-in-time snapshot of the tool/resource/prompt surface for every audited MCP server. `scripts/diff-sweep.sh` compares the current sweep output against the most recent baseline and flags drift — the scenario we care about most is a server silently adding tools, widening permissions, or editing descriptions *after* an audit has already cleared it.

## What's in each snapshot

| Field | Public? | Why |
|-------|---------|-----|
| `server.name`, `server.version`, `server.transport` | yes | Already public in every published MCP server |
| `tools[]` with `name`, `description`, `inputSchema`, `annotations` | yes | Exactly what the server ships to any client that calls `tools/list` — not sensitive |
| `resources[]`, `prompts[]` | yes | Same — public surface already visible to any caller |
| ~`findings`~ | **stripped** | Removed from the published baseline; specific finding details stay withheld per [DISCLOSURE.md](../DISCLOSURE.md) until each maintainer's 90-day window closes |
| ~`summary`~ | **stripped** | Would leak severity counts per server, which is enough to back-solve the affected servers |

The full audit JSONs (with findings) live in `reports/audits/` which is `.gitignored`.

## Index

| Snapshot | Date | Servers | Tools |
|----------|------|---------|-------|
| [`2026-04-18/`](./2026-04-18) | 2026-04-18 | 30 | 184 |

## How to diff

From the repo root:

```bash
npm run diff                                   # diff against latest baseline, fail on high
npm run diff -- baselines/2026-04-18           # against a specific baseline
npm run diff -- --fail-on medium               # tighter threshold
```

`reports/diffs/diff-<slug>.json` gets one file per server (gitignored) plus a top-level `reports/diff-summary.json`. Useful for CI:

```yaml
# .github/workflows/drift-watch.yml (example)
- run: npm run fetch && npm run sweep && npm run diff -- --fail-on high
```

## Adding a new snapshot

After every sweep where the aggregate REPORT is worth freezing (e.g., quarterly, or after a maintainer ships a fix):

```bash
TODAY=$(date -u +%Y-%m-%d)
mkdir -p baselines/$TODAY
cp reports/audits/audit-*.json baselines/$TODAY/
# Strip findings before committing:
node -e "const fs=require('fs');const p=require('path');const d=process.argv[1];for(const f of fs.readdirSync(d)){if(!f.endsWith('.json'))continue;const x=JSON.parse(fs.readFileSync(p.join(d,f),'utf8'));fs.writeFileSync(p.join(d,f),JSON.stringify({auditedAt:x.auditedAt,server:{name:x.server?.name,version:x.server?.version,transport:x.server?.transport},tools:x.tools||[],resources:x.resources||[],prompts:x.prompts||[],_note:'Structural snapshot only. Findings withheld pending coordinated disclosure — see DISCLOSURE.md.'},null,2));}" baselines/$TODAY
git add baselines/$TODAY
git commit -m "Baseline snapshot $TODAY — 30 servers, 184 tools"
```
