import { test } from "node:test";
import assert from "node:assert/strict";
import { isInstallCommand, decide, checkCommand } from "./check-install.mjs";

test("detects install commands", () => {
  for (const c of [
    "npm install @goat-sdk/core", "npm i viem", "pnpm add ethers", "yarn add wagmi", "bun add x",
    "npx -y @coinbase/agentkit-mcp", "pip install web3", "python -m pip install eth-account",
    "uvx mcp-server-foo", "pipx run foo", "claude mcp add --transport http x https://x.dev/mcp",
    "cd app && npm install --save-dev solana-agent-kit",
  ]) assert.equal(isInstallCommand(c), true, c);
});

test("ignores non-install commands", () => {
  for (const c of ["npm test", "npm install", "pnpm i", "npm ci", "ls -la", "git status", "npx tsc", "", null])
    assert.equal(isInstallCommand(c), false, String(c));
});

const res = (egress) => ({
  subjects: [{ subject: { id: "npm:x", name: "x", version: "1.0.0" }, summary: { check_url: "https://satohub.ai/check/package/npm%3Ax" },
    answers: { key_access: "a", key_egress: "b", fund_actions: "c", changes: "d" } }],
  unresolved: [], has_observed_key_egress: egress,
});

test("allows with context by default", () => {
  const out = decide(res(true), {});
  assert.equal(out.hookSpecificOutput.permissionDecision, undefined);
  assert.match(out.hookSpecificOutput.additionalContext, /Does your key leave\? b/);
});

test("blocks only on observed egress with SATO_CHECK_BLOCK=1", () => {
  assert.equal(decide(res(true), { SATO_CHECK_BLOCK: "1" }).hookSpecificOutput.permissionDecision, "deny");
  assert.equal(decide(res(false), { SATO_CHECK_BLOCK: "1" }).hookSpecificOutput.permissionDecision, undefined);
});

test("fails open on network error", async () => {
  assert.equal(await checkCommand("npm i x", async () => { throw new Error("down"); }), null);
  assert.equal(decide(null), null);
});

test("sends the hook UA and only the command", async () => {
  let seen;
  await checkCommand("npm i x", async (url, init) => { seen = init; return { ok: true, json: async () => res(false) }; });
  assert.equal(seen.headers["user-agent"], "sato-check-hook/1.0");
  assert.deepEqual(JSON.parse(seen.body), { command: "npm i x" });
});

test("the hook's output survives a pipe (how Claude Code reads it)", async () => {
  const { createServer } = await import("node:http");
  const { spawn } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const body = JSON.stringify({ subjects: [{ subject: { id: "npm:x", name: "x" }, answers: { key_access: "No private-key read found." } }], unresolved: [], has_observed_key_egress: false });
  const server = createServer((req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.end(body); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/api/check/install`;
  const child = spawn(process.execPath, [fileURLToPath(new URL("./check-install.mjs", import.meta.url))], { env: { ...process.env, SATO_CHECK_URL: url }, stdio: ["pipe", "pipe", "inherit"] });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stdin.end(JSON.stringify({ tool_name: "Bash", tool_input: { command: "npm i x" } }));
  const code = await new Promise((r) => child.on("close", r));
  server.close();
  assert.equal(code, 0);
  assert.match(JSON.parse(out).systemMessage, /No private-key read found/);
});
