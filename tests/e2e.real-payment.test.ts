/**
 * e2e.real-payment.test.ts — real end-to-end payment through the wrapper.
 *
 * Spawns the actual bridgenode-mcp stdio server and drives it with a real
 * MCP client. A `chat_completions` call triggers a REAL x402 payment from
 * the test wallet (BRIDGENODE_WALLET_KEY) to BridgeNode's main wallet —
 * the full chain: 402 → PAYMENT-SIGNATURE → on-chain settle → 200.
 *
 * Money stays in BridgeNode's own wallet (test wallet → main wallet); the
 * only real cost is Solana gas (~0.00001 SOL per TX).
 *
 * Manual run only (writes real tx_log entries):
 *   TEST_WALLET_PK=<test wallet private key> npm run test:e2e
 * Skips when TEST_WALLET_PK is not set.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_ENTRY = path.join(ROOT, "src", "index.ts");

// Remote MCP endpoint: local production server (same as bridgenode.cc,
// but direct — stable for tests). Overridable via BRIDGENODE_MCP_URL.
const MCP_URL =
  process.env.BRIDGENODE_MCP_URL ?? "http://127.0.0.1:8000/mcp";

const hasWallet = Boolean(process.env.BRIDGENODE_WALLET_KEY ?? process.env.TEST_WALLET_PK);

test(
  "real payment e2e: chat_completions via wrapper (402 → settle → 200)",
  { skip: !hasWallet && "set BRIDGENODE_WALLET_KEY or TEST_WALLET_PK to run" },
  async () => {
    const walletKey =
      process.env.BRIDGENODE_WALLET_KEY ?? process.env.TEST_WALLET_PK!;

    const child = spawn(
      process.execPath,
      ["--import", "tsx", SERVER_ENTRY],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          BRIDGENODE_WALLET_KEY: walletKey,
          BRIDGENODE_MCP_URL: MCP_URL,
        },
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    // Capture stderr so failures are debuggable.
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += String(d)));

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", SERVER_ENTRY],
      cwd: ROOT,
      env: {
        ...process.env,
        BRIDGENODE_WALLET_KEY: walletKey,
        BRIDGENODE_MCP_URL: MCP_URL,
      },
    });

    const client = new Client(
      { name: "bridgenode-mcp-e2e-test", version: "0.0.0" },
      { capabilities: {} }
    );

    try {
      await client.connect(transport);

      // tools/list — free, no payment
      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name);
      assert.ok(names.includes("chat_completions"), `tools: ${names.join(", ")}`);
      assert.ok(names.includes("list_models"), `tools: ${names.join(", ")}`);

      // tools/call — triggers a REAL payment (~$0.002 floor)
      const result = await client.callTool({
        name: "chat_completions",
        arguments: {
          model: "deepseek-flash",
          messages: [{ role: "user", content: "Reply with exactly: e2e ok" }],
          max_tokens: 32,
        },
      });

      const content = Array.isArray(result.content)
        ? result.content.map((c) => (c as { text?: string }).text ?? "").join("")
        : String(result.content ?? "");
      assert.ok(content.length > 0, `empty content; stderr: ${stderr}`);
      assert.ok(!result.isError, `isError=true; stderr: ${stderr}`);
    } finally {
      await client.close().catch(() => {});
      child.kill();
    }
  }
);
