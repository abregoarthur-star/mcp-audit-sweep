#!/usr/bin/env bash
# Diff every current audit against the chosen baseline. Reports drift per
# server (new tools, widened permissions, edited descriptions, capability
# additions) and exits non-zero if anything HIGH or CRITICAL surfaced.
#
# Usage:
#   scripts/diff-sweep.sh [baseline-dir] [--fail-on critical|high|medium|low]
#
# Defaults:
#   baseline-dir = baselines/<latest>/  (alphabetically last; ISO dates sort right)
#   fail-on      = high

set -euo pipefail

cd "$(dirname "$0")/.."

BASELINE_DIR=""
FAIL_ON="high"
JSON_OUT="reports/diff-summary.json"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --fail-on) FAIL_ON="$2"; shift 2 ;;
    --json)    JSON_OUT="$2"; shift 2 ;;
    -h|--help)
      grep -E '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      if [ -z "$BASELINE_DIR" ]; then BASELINE_DIR="$1"; shift
      else echo "Unknown arg: $1" >&2; exit 2; fi ;;
  esac
done

if [ -z "$BASELINE_DIR" ]; then
  BASELINE_DIR=$(ls -d baselines/*/ 2>/dev/null | sort | tail -1)
  BASELINE_DIR="${BASELINE_DIR%/}"
fi

if [ ! -d "$BASELINE_DIR" ]; then
  echo "Baseline directory not found: $BASELINE_DIR" >&2
  echo "Available baselines:" >&2
  ls -d baselines/*/ 2>/dev/null >&2 || echo "  (none)" >&2
  exit 2
fi

echo "→ Diffing current audits against baseline: $BASELINE_DIR"
mkdir -p reports/diffs

declare -i SERVERS=0
declare -i WORST_RANK=0
declare -i CRITICAL=0 HIGH=0 MEDIUM=0 LOW=0

# Severity rank for fail-on threshold
case "$FAIL_ON" in
  critical) THRESHOLD=4 ;;
  high)     THRESHOLD=3 ;;
  medium)   THRESHOLD=2 ;;
  low)      THRESHOLD=1 ;;
  *) echo "Invalid --fail-on: $FAIL_ON" >&2; exit 2 ;;
esac

for cur in reports/audits/audit-*.json; do
  slug=$(basename "$cur" .json | sed 's/^audit-//')
  base="$BASELINE_DIR/audit-$slug.json"

  if [ ! -f "$base" ]; then
    echo "  + $slug — NEW SERVER (no baseline)"
    continue
  fi

  out="reports/diffs/diff-$slug.json"
  npx @dj_abstract/mcp-audit diff "$base" "$cur" --quiet --json "$out" 2>/dev/null || true

  if [ ! -s "$out" ]; then continue; fi

  # Pull severity counts via node — bash arithmetic is brittle on JSON
  read C H M L <<< "$(node -e "
    const d = JSON.parse(require('fs').readFileSync('$out','utf8'));
    const f = d.findings || [];
    const c = f.filter(x=>x.severity==='critical').length;
    const h = f.filter(x=>x.severity==='high').length;
    const m = f.filter(x=>x.severity==='medium').length;
    const l = f.filter(x=>x.severity==='low').length;
    process.stdout.write(\`\${c} \${h} \${m} \${l}\`);
  ")"
  CRITICAL+=$C; HIGH+=$H; MEDIUM+=$M; LOW+=$L
  SERVERS+=1

  if (( C+H+M+L > 0 )); then
    echo "  ~ $slug — C:$C H:$H M:$M L:$L"
  fi
done

echo
echo "Summary: $SERVERS servers compared · $CRITICAL critical · $HIGH high · $MEDIUM medium · $LOW low"

# Write top-level summary JSON
node -e "
require('fs').writeFileSync('$JSON_OUT', JSON.stringify({
  baseline: '$BASELINE_DIR',
  comparedAt: new Date().toISOString(),
  servers: $SERVERS,
  drift: { critical: $CRITICAL, high: $HIGH, medium: $MEDIUM, low: $LOW },
}, null, 2));
console.log('Summary JSON: $JSON_OUT');
"

# Apply fail threshold
WORST_RANK=0
(( CRITICAL > 0 )) && WORST_RANK=4
(( WORST_RANK < 3 && HIGH > 0 ))    && WORST_RANK=3
(( WORST_RANK < 2 && MEDIUM > 0 ))  && WORST_RANK=2
(( WORST_RANK < 1 && LOW > 0 ))     && WORST_RANK=1

if (( WORST_RANK >= THRESHOLD )); then
  echo "Drift at or above --fail-on=$FAIL_ON — exiting non-zero"
  exit 1
fi

echo "No drift at or above --fail-on=$FAIL_ON ✓"
