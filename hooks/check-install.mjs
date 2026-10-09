#!/usr/bin/env node
// Sato Check install hook (Claude Code PreToolUse on Bash). Zero dependencies, Node >= 18.
//
// When a Bash command installs a package, MCP server or skill, it asks
// https://satohub.ai/api/check/install for the four answers and shows them.
// Allows by default. Blocks ONLY when a planted test key was observed leaving
// (has_observed_key_egress) AND the user set SATO_CHECK_BLOCK=1.
// Any network error, timeout or odd response: silent, allow.
// Only the install segments of the command are sent, with env values, MCP
// headers and URL credentials redacted — nothing else from the machine.

import { pathToFileURL } from "node:url";

const ENDPOINT = process.env.SATO_CHECK_URL || "https://satohub.ai/api/check/install";
const TIMEOUT_MS = 4000;
// Override for our own sessions (SatoHub-…) so they are not counted as outside adoption.
const UA = process.env.SATO_CHECK_UA || "sato-check-hook/1.0";

// Each pattern is anchored at the START of a command segment (after optional
// env assignments / sudo / a subshell paren), so an installer named inside a
// quoted string — a commit message, a grep pattern, a script body — never
// triggers the hook (found dogfooding in our own sessions, 2026-09-26).
const INSTALL_PATTERNS = [
  /^(?:npm|pnpm|bun)\s+(?:-{1,2}[\w=-]+\s+)*(?:add|install|i|in)\s+\S/,
  /^yarn\s+(?:global\s+)?add\s+\S/,
  /^pip3?\s+install\s+\S/,
  /^python3?\s+-m\s+pip\s+install\s+\S/,
  /^uvx\s+\S/,
  /^uv\s+(?:tool\s+install|pip\s+install|add)\s+\S/,
  /^pipx\s+(?:run|install)\s+\S/,
  /^(?:claude|codex|gemini)\s+mcp\s+add\s+\S/,
  /^clawhub\s+install\s+\S/,
  /^npx\s+skills\s+add\s+\S/,
];

/**
 * `npx`/`bunx` fetches a package only via a flag BEFORE the package name
 * (-y, --yes, -p, --package) or a pinned `name@version`. `npx tsc -p .` is
 * TypeScript's own -p on a local bin, not an install.
 */
export function npxFetches(segment) {
  const m = segment.match(/^(?:npx|bunx)\s+(.*)$/);
  if (!m) return false;
  for (const t of m[1].split(/\s+/)) {
    if (/^(-y|--yes|-p|--package)$/.test(t) || /^--package=/.test(t)) return true;
    if (t.startsWith("-")) continue;
    return /^@?[^@\s]+@\S+$/.test(t);
  }
  return false;
}

const QUOTED = /'[^']*'|"(?:[^"\\]|\\.)*"/g;
// One shell word, quotes included: `"a b"`, `x="a b"`, `viem@^2`.
const WORD = String.raw`(?:'[^']*'|"(?:[^"\\]|\\.)*"|[^\s'"])+`;

/** Blank quoted text (same length) so it is never read as a command or an operator. */
function maskQuoted(s) {
  return s.replace(QUOTED, (q) => "_".repeat(q.length));
}

/**
 * Split on `&&`, `||`, `;`, `|` and newlines outside quotes, keeping the quotes:
 * `npm install 'viem@^2'` used to be sent as `npm install ''` (2026-10-08).
 * An installer named inside a quoted string (a commit message, a grep
 * pattern) stays inside its segment, which does not start with an installer.
 */
function splitSegments(command) {
  const masked = maskQuoted(command);
  const out = [];
  let start = 0;
  for (const m of masked.matchAll(/&&|\|\||;|\||\n/g)) {
    out.push(command.slice(start, m.index));
    start = m.index + m[0].length;
  }
  out.push(command.slice(start));
  return out;
}

/**
 * Cut a segment at its first shell redirection (`2>&1`, `>log`, `>>log`,
 * `2>/dev/null`, `&>f`, `<in`, `1>&2`): the rest is not an install target.
 * A `<` or `>` inside quotes (`'web3>=6'`) or a docs placeholder like
 * `<API_KEY>` is text. `npm install viem 2>&1` sent "2>&1" as a package (2026-10-08).
 */
export function dropRedirections(segment) {
  const r = maskQuoted(segment).replace(/<[\w.-]+>/g, (p) => "_".repeat(p.length)).search(/[<>]/);
  if (r < 0) return segment;
  // A bare fd number or `&` right before the operator belongs to it (`viem2>log` keeps "viem2").
  return segment.slice(0, r).replace(/(?:^|\s)(?:\d+|&)$/, "").replace(/&$/, "").trim();
}

/**
 * Values never leave the machine, quoted or not: `-e KEY=0x…` / `KEY="…"` keep
 * only the name, an MCP header (`-H "Authorization: Bearer …"`) is dropped, and
 * so are credentials in a URL. The server needs package names, not values.
 */
export function redactValues(segment) {
  let s = segment
    .replace(new RegExp(String.raw`(^|\s)([A-Za-z_][A-Za-z0-9_]*)=(?!=)${WORD}`, "g"), "$1$2=<redacted>")
    .replace(/(\b[a-z][\w+.-]*:\/\/)[^\s/@'"]+@/gi, "$1<redacted>@");
  if (/^(?:claude|codex|gemini)\s+mcp\s+add\b/.test(s)) {
    s = s.replace(new RegExp(String.raw`(\s(?:-H|--header)(?:\s+|=))${WORD}`, "g"), "$1<redacted>");
  }
  return s;
}

/** The command segments that install something, cleaned to their command position. */
export function installSegments(command) {
  if (typeof command !== "string" || !command.trim()) return [];
  const out = [];
  const lead = new RegExp(String.raw`^(?:sudo\s+|[A-Z_][A-Z0-9_]*=(?:${WORD})?\s+)+`);
  for (const seg of splitSegments(command)) {
    const s = dropRedirections(seg.trim().replace(/^[({]+\s*/, "").replace(lead, "").trim());
    if (INSTALL_PATTERNS.some((re) => re.test(s)) || npxFetches(s)) out.push(redactValues(s));
  }
  return out;
}

/** True when the shell command installs something we can check. */
export function isInstallCommand(command) {
  return installSegments(command).length > 0;
}

const LABELS = {
  key_access: "Does it take your key?",
  key_egress: "Does your key leave?",
  fund_actions: "Can it move funds on its own?",
  changes: "What changed?",
};

export function formatReport(res) {
  const lines = ["Sato Check — what this install does with keys and money:"];
  for (const s of res.subjects || []) {
    lines.push(`\n${s.subject?.name || s.subject?.id}${s.subject?.version ? `@${s.subject.version}` : ""}`);
    for (const k of Object.keys(LABELS)) if (s.answers?.[k]) lines.push(`  ${LABELS[k]} ${s.answers[k]}`);
    if (s.summary?.check_url) lines.push(`  Full profile: ${s.summary.check_url}`);
  }
  for (const u of res.unresolved || []) lines.push(`\n${u.input}: not profiled (${u.reason})`);
  return lines.join("\n");
}

export async function checkCommand(command, fetchImpl = fetch) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": UA },
      body: JSON.stringify({ command }),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const body = await r.json();
    return body && Array.isArray(body.subjects) ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Returns the hook JSON to print, or null for "say nothing, allow". */
export function decide(res, env = process.env) {
  if (!res || (!res.subjects?.length && !res.unresolved?.length)) return null;
  const report = formatReport(res);
  if (res.has_observed_key_egress === true && env.SATO_CHECK_BLOCK === "1") {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `${report}\n\nBlocked because SATO_CHECK_BLOCK=1 and a planted test key was observed leaving. Unset SATO_CHECK_BLOCK to allow.`,
      },
    };
  }
  return { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: report }, systemMessage: report };
}

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main() {
  try {
    const input = JSON.parse(await readStdin());
    const segments = installSegments(input?.tool_input?.command);
    if (!segments.length) return;
    // Only the install segments leave the machine — never the rest of the command line.
    const out = decide(await checkCommand(segments.join(" && ")));
    // Wait for the write to flush: Claude Code reads hook stdout through a pipe,
    // and exiting before a pipe write drains drops it (found in the 1.2.0 test).
    if (out) await new Promise((resolve) => process.stdout.write(JSON.stringify(out), resolve));
  } catch {
    /* fail open */
  }
}

// No process.exit(): letting the event loop end is what guarantees stdout drains.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().finally(() => { process.exitCode = 0; });
