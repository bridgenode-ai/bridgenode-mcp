#!/usr/bin/env node
/**
 * @bridgenode/mcp — BridgeNode MCP wrapper.
 *
 * stdio MCP server → proxies requests to the remote streamable-HTTP /mcp
 * (https://bridgenode.cc/mcp) with automatic x402 payment (Solana USDC).
 *
 * Usage (one-command install):
 *   claude mcp add bridgenode -s user -- npx -y @bridgenode/mcp@latest
 *
 * Key: .env (`BRIDGENODE_WALLET_KEY` — Solana wallet private key, base58).
 * Spending policy (fail-closed): BRIDGENODE_MAX_PER_CALL (0.05 USD),
 * BRIDGENODE_DAILY_CAP (1.0 USD) — before every payment.
 *
 * Payment flow is implemented here on the raw MCP client (not via
 * x402MCPClient.callTool) because the official x402 MCP client strips
 * `structuredContent` from tool results, and the MCP SDK requires it when
 * a tool declares an outputSchema (our server does) — found by e2e 08-15.
 */
import * as dotenv from "dotenv";
dotenv.config();

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createKeyPairSignerFromBytes, getBase58Encoder } from "@solana/kit";
import { x402Client } from "@x402/core/client";
import { parsePaymentRequired } from "@x402/core/schemas";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { MCP_PAYMENT_META_KEY, extractPaymentResponseFromMeta } from "@x402/mcp";
import type { PaymentRequired } from "@x402/core/types";

// Spending policy (fail-closed) — extracted to a testable module.
import {
  USDC_DECIMALS,
  DAILY_CAP_USD,
  allowPayment,
  amountUsdAtomic,
  recordSpend,
  spentTodayUsd,
} from "./spending.js";

export const REMOTE_MCP_URL =
  process.env.BRIDGENODE_MCP_URL ?? "https://bridgenode.cc/mcp";
export const NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"; // Solana mainnet (CAIP-2)

export { USDC_DECIMALS };

/**
 * Detect a PaymentRequired envelope in a tool result.
 *
 * Our server signals 402 as a result with `isError: true` +
 * `structuredContent` (the x402 envelope) + a JSON text fallback
 * (mcp.py `_payment_required_result`, §7). Returns the parsed
 * PaymentRequired or null.
 */
function extractPaymentRequired(result: unknown): PaymentRequired | null {
  if (typeof result !== "object" || result === null) return null;
  const obj = result as Record<string, unknown>;
  if (obj.isError !== true) return null;

  const candidates: unknown[] = [];
  if (obj.structuredContent !== undefined) candidates.push(obj.structuredContent);
  const content = obj.content;
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0] as { text?: unknown };
    if (typeof first?.text === "string") {
      try {
        candidates.push(JSON.parse(first.text));
      } catch {
        // not JSON — ignore
      }
    }
  }
  for (const c of candidates) {
    const parsed = parsePaymentRequired(c);
    if (parsed.success) return parsed.data as PaymentRequired;
  }
  return null;
}

async function main() {
  const walletKey = process.env.BRIDGENODE_WALLET_KEY;
  if (!walletKey) {
    console.error(
      "BRIDGENODE_WALLET_KEY missing — set it in .env (Solana wallet private key, base58)"
    );
    process.exit(1);
  }

  // Wallet address — from the private key (base58 → 64 bytes → keypair signer)
  const secretKey = new Uint8Array(getBase58Encoder().encode(walletKey));
  const signer = await createKeyPairSignerFromBytes(secretKey);

  // x402 payment client (Solana mainnet, exact scheme)
  const paymentClient = new x402Client().register(
    NETWORK,
    new ExactSvmScheme(signer)
  );

  // MCP client → remote bridgenode.cc/mcp (streamable HTTP)
  const mcpClient = new Client(
    { name: "bridgenode-mcp", version: "0.1.0" },
    { capabilities: {} }
  );

  const transport = new StreamableHTTPClientTransport(
    new URL(REMOTE_MCP_URL)
  );
  await mcpClient.connect(transport);

  // stdio MCP server — proxy to remote
  const server = new Server(
    { name: "bridgenode-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await mcpClient.listTools();
    return { tools: result.tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const callArgs = (args ?? {}) as Record<string, unknown>;

    // First attempt without payment — the raw client preserves the FULL
    // result (content + structuredContent + _meta) that the MCP SDK
    // requires for tools with an outputSchema.
    let result = await mcpClient.callTool({ name, arguments: callArgs });

    // 402 detection: server returns isError:true + structuredContent envelope
    const paymentRequired = extractPaymentRequired(result);
    if (paymentRequired !== null) {
      // Spending policy (fail-closed)
      const amount = amountUsdAtomic(paymentRequired.accepts?.[0]?.amount);
      const reason = allowPayment(amount);
      if (reason !== null) {
        console.error(reason);
        return { content: [{ type: "text", text: reason }], isError: true };
      }

      // Sign the payment and retry with it attached (x402 V2 `_meta`)
      const payload = await paymentClient.createPaymentPayload(paymentRequired);
      result = await mcpClient.callTool({
        name,
        arguments: callArgs,
        _meta: { [MCP_PAYMENT_META_KEY]: payload },
      } as never);

      // Record spend only for submitted (settled) payments — daily cap
      const settle = extractPaymentResponseFromMeta(result as never);
      if (settle !== null && settle !== undefined) {
        recordSpend(amount);
        console.error(
          `Spend recorded: ${amount} USD (today ${spentTodayUsd().toFixed(4)} / ${DAILY_CAP_USD} USD)`
        );
      }
    }

    // Forward the full raw result (content, isError, structuredContent, _meta)
    return result as never;
  });

  const stdio = new StdioServerTransport();
  await server.connect(stdio);
}

main().catch((err) => {
  console.error("bridgenode-mcp error:", err);
  process.exit(1);
});
