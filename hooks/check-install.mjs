#!/usr/bin/env node
// Sato Check install hook (Claude Code PreToolUse on Bash). Zero dependencies, Node >= 18.
//
// When a Bash command installs a package, MCP server or skill, it asks
// https://satohub.ai/api/check/install for the four answers and shows them.
// Allows by default. Blocks ONLY when a planted test key was observed leaving
// (has_observed_key_egress) AND the user set SATO_CHECK_BLOCK=1.
// Any network error, timeout or odd response: silent, allow.
// Only the command text is sent — nothing else from the machine.

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

/** Drop quoted strings so text inside them is never read as a command. */
function stripQuoted(command) {
  return command.replace(/'[^']*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

/** The command segments that install something, cleaned to their command position. */
export function installSegments(command) {
  if (typeof command !== "string" || !command.trim()) return [];
  const out = [];
  for (const seg of stripQuoted(command).split(/&&|\|\||;|\||\n/)) {
    const s = seg.trim().replace(/^[({]+\s*/, "").replace(/^(?:sudo\s+|[A-Z_][A-Z0-9_]*=\S*\s+)+/, "").trim();
    if (INSTALL_PATTERNS.some((re) => re.test(s)) || npxFetches(s)) out.push(s);
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
