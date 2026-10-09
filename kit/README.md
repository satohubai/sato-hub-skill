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

Server: `https://satohub.ai/api/mcp` — Streamable HTTP, no key. Most tools only read; the few that can change Sato Hub state say so in their annotations, and none signs or moves funds.
One-click install for every client: <https://satohub.ai/mcp#install>.

Raw files: <https://satohub.ai/instructions/AGENTS.md>, `/instructions/CLAUDE.md`,
`/instructions/satohub.mdc`, `/instructions/windsurfrules`.

The rules all say the same three things, because they are the things that go
wrong: cite the record's `sato_url`, keep `Self-Reported` distinct from
verified, and treat `null` as unknown rather than zero.
