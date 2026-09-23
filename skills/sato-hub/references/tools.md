# Sato Hub MCP — the 32 tools

Endpoint: `POST https://satohub.ai/api/mcp` (Streamable HTTP, JSON-RPC 2.0,
28 read-only; the four WRITE tools marked below can change Sato Hub state and none of them signs, holds or broadcasts funds; no auth). All tool names start with `onchain_agent_`. Most tools
accept `response_format: "markdown" | "json"` (default markdown). Every record
carries `sato_url` and, where scored, `verify_url` — cite `sato_url`.

## Search and detail

- `onchain_agent_search_resources` — search the directory of what agents are built from; each hit scored from public evidence. Args: `query`, `chain`, `category`, `status`, `liveness`, `is_agent`, `is_skill`, `is_harness`, `featured`, `entity_class` (resource|agent|reference), `resource_type`, `use_case`, `standard`, `iface`, `integration`, `deploys_as`, `creator`, `min_observed_success`, `min_observed_days`, `verified_only`, `sort`, `limit`, `offset`.
- `onchain_agent_get_score_methodology` — the Sato Score rubric: six components with max points and what each measures, tier cutoffs, what is NOT in the score, how to reproduce it. Call this before describing or applying the score; never infer the rules. No args.
- `onchain_agent_get_resource` — the full record for one listing by slug: Sato Score + components, liveness, verification_status, creator, deployment options, integrations, provenance, optional recent releases/posts. Args: `slug`, `include_activity` (default true).
- `onchain_agent_get_deploy_spec` — the structured deploy manifest for one listing: runtime, install commands, entry snippet, required keys/env/wallet/RPC, chains, license, whether it is an MCP server, and `deploy_status` (reproduced by Sato Hub or self-reported). Args: `slug`.
- `onchain_agent_list_categories` — category vocabulary with counts. No args.
- `onchain_agent_list_chains` — chains represented in the directory with counts. No args.

## Recommend and compare

- `onchain_agent_recommend_stack` — a goal in plain words → a ranked stack of real listings bucketed by slot (framework, wallet, payments, trading, data, MCP tooling, security), each with Sato Score, liveness, deploy-spec status, plus explicit gaps. Ranking is openness/activity/verifiability, never a safety or returns judgment. Args: `goal` (3–300 chars), `chain`, `max_per_slot` (1–5), `verified_only`.
- `onchain_agent_compare_listings` — two listings on the same derived axes (category, chains, interfaces, standards, open source, status, last activity/release, install proof, verification, Sato Score, stars). No winner is declared; carries a mandatory caveat. Args: `a`, `b` (slugs).

## Agent economy, trends, numbers

- `onchain_agent_get_agent_economy` — what is happening on-chain across tracked venues (erc8004, olas, virtuals, x402, erc4337_accounts, key_management, singularitynet, morpheus): per venue, per chain, per lifecycle stage, with unit, method, sample size, evidence tier and `publishable`. Args: `venue`, `chain`, `include_platforms`.
- `onchain_agent_get_trend` — is one measurement going up or down: a bounded series for ONE venue + chain + stage, each point dated with value, sample size and method. Args: `venue`, `stage`, `chain`, `points`, `grain` (weekly|daily).
- `onchain_agent_explain_number` — where a published Sato Hub number comes from: the finding with stage, method, sample, as-of date and the SQL that reproduces it; citable at `/numbers/<slug>`. Args: `slug`.
- `onchain_agent_get_metrics` — live ecosystem numbers: the ERC-8004 Identity Registry registered-agent count read from Ethereum mainnet, and the curated Top Project Tokens index (directory-listed projects only). Args: `token_limit` (1–25).
- `onchain_agent_get_listing_history` — has this listing been answering Sato Hub's daily checks, and has its MCP tool inventory moved: 30-day observed record (days observed, share of OUR checks that succeeded, state, streak) plus tool-inventory changes and the current Sato Score. Args: `slug`, `days` (1–30).

## Agent Passports (registered running agents)

- `onchain_agent_search_agents` — search agents whose operators registered them for a Sato Agent Passport (distinct from the directory). Only review-listed agents are returned. Args: `query`, `chain`, `agent_type`, `x402_only`, `limit`.
- `onchain_agent_get_agent_passport` — one agent's `sato.agent.manifest/v1`: identity, agent types, chains, model/framework, the directory stack it runs on, links, x402 payment metadata, verification and liveness status. Args: `slug`.

## Skills

- `onchain_agent_search_skills` — crypto-relevant agent skills from ClawHub and skills.sh, each with a static disclosure: hosts contacted, private-key generation/handling, credential requests, remote-to-shell, unrestricted tool grants, third-party registration, self-scheduling. A disclosure describes; it never says safe. Args: `query`, `registry` (clawhub|skillssh|github), `flag`, `slug`, `limit`.

## Before you act: Preflight and Sato Route

These five answer "what should I do next", not "what exists". They are still
read-only: **nothing here signs, holds a key, deploys, relays or moves funds.**
A route returns a recommendation and, where a venue documents one, calldata or
a config the caller reads and signs itself. A route that is never signed costs
nothing.

- `onchain_agent_preflight` — one check before you install a package, clone a repo, connect to an MCP endpoint, pay an agent, or trade a token. Pass exactly ONE of `repo`, `package`, `endpoint`, `agent` (`<chain>:<id>`), or `token` (+ `chain`, EVM only). Returns `verdict` (`go` | `caution` | `no` | `unknown`), the `rule` id that decided it, and one evidence line per check naming the field it was read from and when that field was written. An unlisted endpoint gets ONE live handshake (initialize + tools/list, 8 s cap) and can never come back `go` — a handshake is not a record. Args: `repo`, `package`, `endpoint`, `agent`, `token`, `chain`, `response_format`.
- `onchain_agent_route_swap` — which venue would Sato Route send this swap to, with the fee disclosed before anything is signed. Asks every aggregator adapter that quotes on the chain (Jupiter, 0x, 1inch, Odos) in parallel and returns the chosen venue's quote and calldata. Args: `chain`, `token_in`, `token_out`, `amount` (input token base units), `slippage_bps`, `taker`, `response_format`.
- `onchain_agent_route_agent` — which registered agent would Sato Route send this task to, and on what readings. Candidates are the listed Sato Agent Passports; the top 3 by the static ranking get one live MCP handshake before the pick. Args: `capability`, `chain`, `requires_mcp`, `requires_x402`, `response_format`.
- `onchain_agent_route_launch` — where would Sato Route send this token launch, on what published venue facts, and what routing through us costs. Venues: Clanker v4, Bankr, Virtuals, Zora creator coins. The Clanker lane returns a prepared config in the documented clanker-sdk v4 `deploy()` shape; the others are recommend-only and say why. Args: `chain`, `goal` (`agent_token` | `creator_coin` | `meme` | `utility`), `name`, `symbol`, `deployer`, `max_pool_fee_pct`, `require_programmable_fee_split`, `response_format`.
- `onchain_agent_build_plan` — Sato Bot's brain. A goal in plain words → a build plan: the goal restated, a stack of REAL directory listings (each with Sato Score, liveness, observed check record and `sato_url`), the deploy spec for every item that publishes one, a Preflight verdict per item, the first action when the goal implies one, the open questions and the next steps. Composes the other tools; invents nothing. Args: `goal` (3–600 chars), `chain`, `budget_usd`, `constraints[]`, `response_format`.

### The rules these five carry

- **"<Venue> was chosen by Sato Route on `<date>`, because …"** is the framing
  every route answer uses. `chosen_by` names each signal, its value, the exact
  field it was read from, and `checked_at`. Never *best*, *safe*, *trusted*,
  *rug-free* or anything about returns.
- **Non-custodial, always.** Sato Route never signs, holds, moves or broadcasts
  funds, never deploys a contract, never relays or settles an x402 payment. The
  caller signs with its own signer.
- **The fee is disclosed on every response, including when it is zero.** Swap:
  3 bps stable-to-stable, 15 bps on any volatile leg, taken as a parameter on
  the aggregator's own quote inside the swap transaction. Launch: one entry in
  the venue's own reward-recipient list — deployer takes `10000 - bps`, Sato
  takes `bps`, and at 0 bps no Sato recipient appears in the config at all.
- **A verdict names what was checked and when.** Preflight is not a security
  review, an audit, a token screen or a forecast, and `unknown` means Sato Hub
  holds no record — not that something is wrong.
- **`null` is unknown, never zero.** A venue that publishes no per-party fee
  split is unread, not generous, and ranks below every venue that publishes a
  number. An unread feedback count ranks below a read count of 0.
- **Permanently null in the token lane, and said so in the evidence:** holder
  concentration (no keyless public source; explorers are not scraped) and
  Uniswap v4 / non-Uniswap liquidity (a v4 poolId cannot be reconstructed from
  a token address). A pool existing is existence, not depth.
- **A quote is a quote, not a fill.** A verified x402 endpoint answered HTTP 402
  with a parseable payload on its check date — not a delivery or solvency claim.

## Build, scaffold, watch

- `onchain_agent_route_lp` — which Uniswap v3 pool and fee tier for a pair: every pool found across the four tiers with in-range liquidity, counted swaps/volume, the window covered, and a fee-revenue PROXY (published fee rate × observed volume — never revenue, APR or yield; impermanent loss is not modelled). Args: `chain`, `token_a`, `token_b`.
- `onchain_agent_scaffold_plan` — a goal → a starter repository as a zip: the plan with every source URL, the signed plan JSON, `.env.example` from the stack's declared env names, `install.sh` under each item's Preflight verdict, chain/venue config with `chosen_by`, and `.mcp.json`. Nothing is generated from imagination — every line cites a listing. Args: `goal`, `chain`.
- `onchain_agent_swap` — WRITE in `build-tx` mode. Chooses the venue, quotes that venue's own fee sentence verbatim, then checks both tokens, the venue endpoint and the recipient against the caller's policy. `recommend` never returns a transaction; `build-tx` returns an UNSIGNED one and records a receipt, and only when the gate allowed it and a simulation did not revert. `unknown` refuses by default and names the lane it could not read. A recipient with no Passport is `no_record`, not a finding. Sato Hub holds no keys and signs nothing. Args: `mode`, `chain`, `token_in`, `token_out`, `amount`, `taker`, `recipient`, `policy`.
- `onchain_agent_watch` — WRITE. Subscribe a repo, package, MCP endpoint or ERC-8004 agent to a daily Preflight re-check; an email goes out only when the verdict changes. No IP stored. Args: `target`, `email`.
- `onchain_agent_submit_project` — WRITE. Files a directory submission into the same queue and daily triage as the /submit form; duplicates return the existing entry. Submission is not verification; profit/safety copy is refused. Args: `name`, `website_url`, `github_url`, `category`, `description`.
- `onchain_agent_register_agent` — WRITE. An agent issues itself a Passport: call once for the challenge, sign with the agent's wallet key, call again. Unsigned registrations wait for a person. The signature proves control of the key only; every passport is Self-Reported. Args: `name`, `wallet`, `signature`, …

## News, changes, wiki

- `onchain_agent_get_news` — dated, source-attributed releases, announcements and reputable RSS, filtered to the agent economy. Args: `kind` (release|tweet|news|research), `chain`, `limit`, `offset`.
- `onchain_agent_recent_changes` — the Listing History: status flips, verification grants, Sato Score tier moves, liveness changes, releases, enrichment. Omit `slug` for the site-wide feed. Args: `slug`, `days` (1–90), `limit`.
- `onchain_agent_get_changes` — what changed since a date (additions, per-listing events, retirements) to keep a local copy in sync without re-fetching the catalog. Args: `since` (YYYY-MM-DD, ≤90-day window).
- `onchain_agent_list_wiki_pages` — wiki index (slug, title, keyword, summary, last_updated). No args.
- `onchain_agent_get_wiki_page` — one sourced explainer by slug (what x402 is, how agents hold wallets, what ERC-8004 does): summary, why it matters, how it works, components, examples, risks, related pages. Args: `slug`.
