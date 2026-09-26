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
const UA = "sato-check-hook/1.0";

const INSTALL_PATTERNS = [
  /\b(?:npm|pnpm|bun)\s+(?:[\w-]+\s+)*?(?:add|install|i)\b/,
  /\byarn\s+(?:global\s+)?add\b/,
  /\bnpx\s+(?:-y|--yes)\b/,
  /\bpip3?\s+install\b/,
  /\bpython3?\s+-m\s+pip\s+install\b/,
  /\buvx\s+\S/,
  /\buv\s+(?:tool\s+install|pip\s+install|add)\b/,
  /\bpipx\s+(?:run|install)\b/,
  /\bclaude\s+mcp\s+add\b/,
  /\b(?:codex|gemini)\s+mcp\s+add\b/,
  /\bclawhub\s+install\b/,
  /\bnpx\s+skills\s+add\b/,
];

/** True when the shell command looks like an install we can check. Bare `npm install` (no target) is skipped. */
export function isInstallCommand(command) {
  if (typeof command !== "string" || !command.trim()) return false;
  const segments = command.split(/&&|\|\||;|\|/);
  return segments.some((seg) => {
    const s = seg.trim();
    if (!INSTALL_PATTERNS.some((re) => re.test(s))) return false;
    // `npm install` / `pnpm i` / `bun install` with no package: installs the lockfile, nothing new.
    if (/^(?:npm|pnpm|bun|yarn)\s+(?:install|i|ci)(?:\s+-{1,2}[\w=-]+)*\s*$/.test(s)) return false;
    return true;
  });
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
    const command = input?.tool_input?.command;
    if (!isInstallCommand(command)) return;
    const out = decide(await checkCommand(command));
    // Wait for the write to flush: Claude Code reads hook stdout through a pipe,
    // and exiting before a pipe write drains drops it (found in the 1.2.0 test).
    if (out) await new Promise((resolve) => process.stdout.write(JSON.stringify(out), resolve));
  } catch {
    /* fail open */
  }
}

// No process.exit(): letting the event loop end is what guarantees stdout drains.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().finally(() => { process.exitCode = 0; });
