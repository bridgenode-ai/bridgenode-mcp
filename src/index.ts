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
import { createKeyPairSignerFromBytes, getBase58Encoder, signatureBytes, verifySignature } from "@solana/kit";
import { getTransactionDecoder } from "@solana/transactions";
import { x402Client } from "@x402/core/client";
import { parsePaymentRequired } from "@x402/core/schemas";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { MCP_PAYMENT_META_KEY, extractPaymentResponseFromMeta } from "@x402/mcp";
import type { PaymentRequired, SettleResponse } from "@x402/core/types";

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
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Solana USDC

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

/**
 * Fail-closed payment requirement selection (item 36, §5.6/§8.2).
 *
 * Picks the FIRST accepts entry that is exact + Solana mainnet + USDC.
 * The x402 client's ExactSvmScheme selects a supported entry by
 * scheme/network only — it does NOT check the asset. So we verify
 * BEFORE signing: any other mint, network, scheme, or empty accepts
 * → error, NO payment is made (per-mint overpayment protection).
 */
function selectPaymentRequirement(paymentRequired: PaymentRequired): PaymentRequired["accepts"][number] {
  const accepts = Array.isArray(paymentRequired.accepts)
    ? paymentRequired.accepts
    : [paymentRequired.accepts].filter(Boolean);
  for (const req of accepts) {
    if (req.scheme !== "exact") continue;
    if (req.network !== NETWORK) continue;
    if (req.asset !== USDC_MINT) {
      throw new Error(
        `Unsupported payment asset ${req.asset} — expected USDC ` +
        `(${USDC_MINT}); no payment made`
      );
    }
    return req;
  }
  throw new Error(
    "No supported payment requirement (exact + Solana mainnet + USDC) — no payment made"
  );
}

/**
 * Verify the PAYMENT-RESPONSE receipt against OUR payment payload
 * (Free-Riding protection, §8.4) — ported from sdk-ts `_verifyReceipt`.
 *
 * `transaction` = the fee payer's Ed25519 signature over OUR TX message;
 * the server must prove it settled EXACTLY our TX. Any mismatch → error
 * (the payment must NOT be recorded as spent).
 */
async function verifyReceipt(
  payload: PaymentRequired["accepts"] extends never ? never : {
    payload: { transaction?: unknown };
    accepted: { extra?: Record<string, unknown>; amount?: unknown };
  },
  settle: SettleResponse,
  walletAddress: string,
): Promise<void> {
  if (!settle.success) {
    throw new Error(`Payment failed: ${settle.errorReason ?? "unknown"}`);
  }
  if (settle.network !== NETWORK) {
    throw new Error(`Receipt network mismatch: ${settle.network} != ${NETWORK}`);
  }
  if (settle.payer !== walletAddress) {
    throw new Error(`Receipt payer mismatch: ${settle.payer} != ${walletAddress}`);
  }

  // transaction = fee payer signature over OUR TX message (Free-Riding:
  // the server must prove it settled EXACTLY our TX)
  try {
    const txB64 = payload.payload.transaction;
    if (typeof txB64 !== "string" || !txB64) {
      throw new Error("Receipt verification: transaction missing in payload");
    }
    const wireBytes = Uint8Array.from(Buffer.from(txB64, "base64"));
    const tx = getTransactionDecoder().decode(wireBytes);
    const feePayer = payload.accepted.extra?.feePayer;
    if (typeof feePayer !== "string" || !feePayer) {
      throw new Error("Receipt verification: fee payer missing");
    }
    // verifySignature(CryptoKey, SignatureBytes, message) — positional
    const pubKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(getBase58Encoder().encode(feePayer)),
      { name: "Ed25519" },
      /* extractable */ false,
      ["verify"],
    );
    const sigBytes = signatureBytes(new Uint8Array(
      getBase58Encoder().encode(settle.transaction)));
    const ok = await verifySignature(pubKey, sigBytes, tx.messageBytes);
    if (!ok) {
      throw new Error(
        "Receipt transaction does not match our TX — possible fraud");
    }
  } catch (err) {
    if (err instanceof Error &&
        (err.message.startsWith("Receipt") ||
         err.message.startsWith("Payment failed"))) {
      throw err;
    }
    throw new Error(`Receipt verification failed: ${(err as Error).message}`);
  }

  const expectedAmount = payload.accepted.amount;
  if (settle.amount != null && settle.amount !== undefined
      && Number(settle.amount) !== Number(expectedAmount)) {
    throw new Error(
      `Receipt amount mismatch: ${settle.amount} != ${expectedAmount}`);
  }
}

/**
 * Lazy payment client — created only when a payment is actually needed.
 *
 * Server startup NEVER depends on a valid wallet key: a missing or malformed
 * BRIGDENODE_WALLET_KEY must not crash the server (Glama build test starts
 * the server with a placeholder key). Payments without a valid key fail
 * closed with a clear tool error instead — fail-closed is preserved because
 * no payment is ever signed with an invalid key (§1090 spending policy).
 */
let paymentClientPromise: Promise<{
  paymentClient: ReturnType<x402Client["register"]>;
  walletAddress: string;
}> | null = null;

function getPaymentClient() {
  if (paymentClientPromise === null) {
    paymentClientPromise = (async () => {
      const walletKey = process.env.BRIDGENODE_WALLET_KEY;
      if (!walletKey) {
        throw new Error(
          "BRIDGENODE_WALLET_KEY missing — set it in .env (Solana wallet private key, base58)"
        );
      }

      // Wallet address — from the private key (base58 → 64 bytes → keypair signer)
      const secretKey = new Uint8Array(getBase58Encoder().encode(walletKey));
      const signer = await createKeyPairSignerFromBytes(secretKey);

      // x402 payment client (Solana mainnet, exact scheme)
      const paymentClient = new x402Client().register(
        NETWORK,
        new ExactSvmScheme(signer)
      );
      return { paymentClient, walletAddress: signer.address };
    })();
  }
  return paymentClientPromise;
}

async function main() {
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
      // Fail-closed asset/network check BEFORE signing (item 36, §5.6/§8.2)
      let requirement;
      try {
        requirement = selectPaymentRequirement(paymentRequired);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(message);
        return { content: [{ type: "text", text: message }], isError: true };
      }

      // Spending policy (fail-closed)
      const amount = amountUsdAtomic(requirement.amount);
      const reason = allowPayment(amount);
      if (reason !== null) {
        console.error(reason);
        return { content: [{ type: "text", text: reason }], isError: true };
      }

      // Sign the payment and retry with it attached (x402 V2 `_meta`)
      // Lazy client: invalid/missing wallet key → clear tool error, no crash
      let paymentClient: ReturnType<x402Client["register"]>;
      let walletAddress: string;
      try {
        const pc = await getPaymentClient();
        paymentClient = pc.paymentClient;
        walletAddress = pc.walletAddress;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(message);
        return { content: [{ type: "text", text: message }], isError: true };
      }
      const payload = await paymentClient.createPaymentPayload(paymentRequired);
      result = await mcpClient.callTool({
        name,
        arguments: callArgs,
        _meta: { [MCP_PAYMENT_META_KEY]: payload },
      } as never);

      // Verify the receipt BEFORE recording spend (Free-Riding protection,
      // §8.4) — fee payer signature must match OUR TX message
      const settle = extractPaymentResponseFromMeta(result as never);
      if (settle !== null && settle !== undefined) {
        try {
          await verifyReceipt(payload, settle, walletAddress);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Receipt verification failed: ${message}`);
          return {
            content: [{
              type: "text",
              text: `Payment receipt verification failed: ${message}`,
            }],
            isError: true,
          };
        }
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
