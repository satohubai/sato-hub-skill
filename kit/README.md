# Sato Hub agent kit

Drop-in rules files that tell a coding agent to reach for the Sato Hub MCP
server when a question is about onchain agents and what to build them from.

| File | Where it goes | Client |
| --- | --- | --- |
| `AGENTS.md` | `AGENTS.md` (repo root) | Codex CLI, Amp, Jules, most AGENTS.md readers |
| `CLAUDE.md` | `CLAUDE.md` (repo root) | Claude Code |
| `satohub.mdc` | `.cursor/rules/satohub.mdc` | Cursor |
| `windsurfrules` | `.windsurfrules` (repo root) | Windsurf |

Each is a section, not a whole file — paste it into what you already have.

Server: `https://satohub.ai/api/mcp` — Streamable HTTP, read-only, no auth, no key.
One-click install for every client: <https://satohub.ai/install>.

Raw files: <https://satohub.ai/kit/AGENTS.md>, `/kit/CLAUDE.md`,
`/kit/satohub.mdc`, `/kit/windsurfrules`.

The rules all say the same three things, because they are the things that go
wrong: cite the record's `sato_url`, keep `Self-Reported` distinct from
verified, and treat `null` as unknown rather than zero.
