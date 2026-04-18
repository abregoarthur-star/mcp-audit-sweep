# Coordinated Disclosure Tracker

This file tracks the lifecycle of every finding from the [MCP Security Sweep](./REPORT.md). Specific vulnerability details remain withheld until each maintainer's disclosure window closes (90 days from initial notification, or earlier if the maintainer ships a fix and approves disclosure).

| ID | Server | Severity | Reported | Status | Public ETA |
|----|--------|----------|----------|--------|-----------|
| MCP-SWEEP-001 | `everything` (modelcontextprotocol/servers) | high | 2026-04-18 | Reported | 2026-07-17 |
| MCP-SWEEP-002 | `memory` (modelcontextprotocol/servers) | medium | 2026-04-18 | Reported | 2026-07-17 |
| MCP-SWEEP-003 | `memory` (modelcontextprotocol/servers) | medium | 2026-04-18 | Reported | 2026-07-17 |
| MCP-SWEEP-004 | `memory` (modelcontextprotocol/servers) | medium | 2026-04-18 | Reported | 2026-07-17 |
| MCP-SWEEP-005 | `sb-branching-tools` (Supabase MCP) | medium | — | Queued | TBD |
| MCP-SWEEP-006 | `sb-branching-tools` (Supabase MCP) | medium | — | Queued | TBD |

## Status definitions

- **Queued** — finding is drafted and awaiting outbound notification
- **Reported** — initial notification delivered to the maintainer's documented security contact; 90-day clock started
- **Acknowledged** — maintainer has confirmed receipt
- **Triaged** — maintainer agrees the finding is valid and is working on a fix
- **Disputed** — maintainer believes the finding is intended behavior or out of scope
- **Fixed** — patched commit shipped; awaiting public release
- **Public** — maintainer has approved publication; details added to `REPORT-full.md`

## Disclosure policy

90-day clock from initial notification. The clock is paused only by:
- A maintainer-confirmed fix in flight with a concrete ETA
- A request for an additional 30-day extension with engineering rationale

Findings that match an actively exploited pattern in the wild may be disclosed earlier, in coordination with the maintainer.

## Reporting channels

| Maintainer | Channel |
|------------|---------|
| Anthropic / `modelcontextprotocol/servers` | [`SECURITY.md`](https://github.com/modelcontextprotocol/servers/security) — GitHub private vulnerability disclosure |
| Supabase | [security@supabase.io](mailto:security@supabase.io) (per their public security policy) |
| Cloudflare | [hackerone.com/cloudflare](https://hackerone.com/cloudflare) |

## Updates

Each row's `Status` and `Public ETA` columns are updated as maintainers respond. Commit messages reference the finding ID. After public disclosure, the row links to the public writeup and CVE (if assigned).

---

If you are a maintainer of a server in this sweep and have not received a notification, please open a GitHub Issue on this repo with the subject "Security disclosure inquiry" — do **not** include vulnerability details in the issue body.
