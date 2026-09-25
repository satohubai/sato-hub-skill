# Sato Hub skill

An [Agent Skill](https://agentskills.io/specification) that teaches a coding
agent how to query **Sato Hub** — the scored, daily-rebuilt index of what
onchain agents are built from (frameworks, MCP servers, wallets, x402 and
stablecoin payment rails, ERC-8004 identity, trading venues, agent skills),
plus measured agent-economy numbers and Agent Passports.

It also covers the five tools that answer *what should I do next*: **Preflight**
(check a repo, package, MCP endpoint, ERC-8004 agent or ERC-20 token before you
act on it), **Sato Route** (pick a swap venue, a task agent, or a token-launch
venue, with the fee disclosed and every reason named), and **Sato Bot's build
plan** (a goal in plain words → a stack of real listings, deploy specs,
Preflight verdicts and a first action).

**Non-custodial.** Nothing in this skill signs, holds a key, deploys, relays or
moves funds. A route returns calldata or a config the caller reads and signs
itself; a route that is never signed costs nothing. The Sato fee — 3 bps
stable-to-stable and 15 bps on any volatile leg for swaps, and for launches one
entry in the venue's own reward-recipient list — is stated on every response,
including when it is zero.

Keyless. Hosted MCP endpoint: `POST https://satohub.ai/api/mcp`
(Streamable HTTP, 35 tools — 31 read-only, four can change Sato Hub state).
Docs: https://satohub.ai/mcp

The skill contains the tool reference, the REST fallback, a curl wrapper that
works without any MCP client, and the rules an agent must carry into its
answers (citation, null = unknown, no summing across venues, what the Sato
Score is and is not).

## Install it in one line

```sh
claude mcp add --transport http satohub https://satohub.ai/api/mcp   # Claude Code
codex mcp add satohub --url https://satohub.ai/api/mcp               # Codex CLI
gemini mcp add --transport http satohub https://satohub.ai/api/mcp   # Gemini CLI
```

One click for [VS Code](https://vscode.dev/redirect/mcp/install?name=satohub&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fsatohub.ai%2Fapi%2Fmcp%22%7D)
or [VS Code Insiders](https://insiders.vscode.dev/redirect/mcp/install?name=satohub&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fsatohub.ai%2Fapi%2Fmcp%22%7D&quality=insiders).

**Cursor, Windsurf, Zed, Cline, Continue, JetBrains, LM Studio, Goose, Warp,
Claude Desktop** — deep links and the exact config block for each, generated
from one endpoint constant: **<https://satohub.ai/install>**
(machine-readable at [`/api/install.json`](https://satohub.ai/api/install.json)).
GitHub strips `cursor://` and `lmstudio://` links from READMEs, which is why the
one-click buttons live on that page rather than here.

Then drop in the [agent kit](https://satohub.ai/kit) — `AGENTS.md`,
`CLAUDE.md`, `.cursor/rules/satohub.mdc`, `.windsurfrules` — so the model
reaches for the server instead of answering from memory. Copies in
[`kit/`](./kit).

## Install

**skills CLI** (any agent that reads `skills/`)

```sh
npx skills add satohubai/sato-hub-skill
```

**Claude Code** — as a plugin (skill + MCP server together), inside a session:

```
/plugin marketplace add satohubai/sato-plugins
/plugin install sato-hub@sato-plugins
```

[`satohubai/sato-plugins`](https://github.com/satohubai/sato-plugins) is the
Sato Hub plugin marketplace; the `sato-hub` plugin it lists is this repo, so
the two never drift. This repo also carries its own
`.claude-plugin/marketplace.json`, so
`/plugin marketplace add satohubai/sato-hub-skill` +
`/plugin install sato-hub@sato-hub-skill` installs the same plugin directly.

or just the MCP server:

```sh
claude mcp add --transport http satohub https://satohub.ai/api/mcp
```

**Codex / OpenAI-compatible plugin hosts** — `.codex-plugin/plugin.json` and
the root `plugin.json` follow the Agent Plugins schema; the MCP server is
declared in `.codex-plugin/mcp.json` as `streamable-http`.

**Cursor** — copy `skills/sato-hub/` into `.cursor/skills/` (or your rules
folder), and add the server from `.mcp.json` to `.cursor/mcp.json`.

**Hermes / any other agent** — copy `skills/sato-hub/` into the agent's skills
directory. `skills/sato-hub/scripts/query.sh` needs only bash + curl.

**Gemini CLI** — `gemini-extension.json` declares the MCP server.

## Use

```sh
skills/sato-hub/scripts/query.sh search_resources '{"query":"x402","limit":3}'
skills/sato-hub/scripts/query.sh get_resource '{"slug":"x402","response_format":"json"}'
skills/sato-hub/scripts/query.sh recommend_stack '{"goal":"agent that pays for APIs with USDC on Base","chain":"Base"}'
skills/sato-hub/scripts/query.sh tools
skills/sato-hub/scripts/query.sh rest '/api/export/index.json?chain=Base'
skills/sato-hub/scripts/query.sh preflight '{"repo":"coinbase/agentkit","response_format":"json"}'
skills/sato-hub/scripts/query.sh route_launch '{"chain":"Base","goal":"agent_token"}'
skills/sato-hub/scripts/query.sh build_plan '{"goal":"a Base agent that pays for APIs in USDC"}'
```

Full tool list: [`skills/sato-hub/references/tools.md`](skills/sato-hub/references/tools.md).
REST endpoints: [`references/rest.md`](skills/sato-hub/references/rest.md).
Real outputs: [`references/examples.md`](skills/sato-hub/references/examples.md).

## Citation rule

Every record carries `sato_url` (its canonical page) and, where scored,
`verify_url` (the Sato Score report). When the data is surfaced in an answer,
cite the `sato_url` so the reader can check the current state.

## What the Sato Score is

A 0–100 measure of how open, active and verifiable a project is —
[methodology](https://satohub.ai/sato-score). It is not a safety, quality or
returns grade. `verification_status` separates self-reported from verified;
`null` means unknown, never zero; agent-economy rows are never summed across
venues, chains or stages.

## Layout

```
skills/sato-hub/SKILL.md          the skill (agentskills.io format)
skills/sato-hub/scripts/query.sh  curl wrapper: MCP tools/call, tools/list, REST GET
skills/sato-hub/references/       tools.md · rest.md · examples.md
.claude-plugin/                   Claude Code plugin + marketplace manifests
.mcp.json                         MCP server config (Claude shape, type: http)
.codex-plugin/                    Codex manifest + streamable-http MCP config
plugin.json                       portable Agent Plugins manifest
gemini-extension.json             Gemini CLI extension
```

## License

Code and documentation: MIT (c) Sato Hub. Catalog data returned by the
endpoints: CC-BY-4.0, attribution "data by satohub.ai".
