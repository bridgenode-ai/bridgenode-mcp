---
name: bridgenode
description: BridgeNode MCP wrapper — stdio MCP server proxying to remote streamable-HTTP endpoint with automatic x402 payment on Solana USDC. No API keys. Use when an agent needs LLM inference through MCP (Claude Code, Cursor, etc.) and has no provider API key.
metadata:
  author: BridgeNode
  version: "1.0.0"
  url: https://bridgenode.cc
  repository: https://github.com/bridgenode-ai/bridgenode-mcp
  network: solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
  currency: USDC
compatibility: MCP clients (Claude Code, Cursor, other stdio MCP clients); Node >= 20
---

# BridgeNode MCP Wrapper

## Overview

`@bridgenode/mcp` is a stdio MCP server that proxies to `https://bridgenode.cc/mcp` (streamable HTTP) with automatic x402 payment on Solana USDC. No API keys, no registration, no subscriptions. Transaction fees (SOL) are sponsored — the agent only needs USDC in its wallet.

## Install (one command)

```bash
claude mcp add bridgenode -s user -- npx -y @bridgenode/mcp@latest
```

Or manually:

```json
{
  "mcpServers": {
    "bridgenode": {
      "command": "npx",
      "args": ["-y", "@bridgenode/mcp@latest"]
    }
  }
}
```

## Environment

```bash
BRIDGENODE_WALLET_KEY=***            # required — Solana wallet private key (base58)
BRIDGENODE_MAX_PER_CALL=0.05         # optional — max USD per call (fail-closed)
BRIDGENODE_DAILY_CAP=1.0             # optional — max USD per day (fail-closed)
```

## Tools

- `chat_completions` — AI inference (paid; x402 payment automatic)
- `list_models` — model list with live prices (free)
- `get_price_estimate` — estimate cost of a chat request (free)

## How it works

1. Local MCP client launches the wrapper via stdio
2. Wrapper connects to `https://bridgenode.cc/mcp` (streamable HTTP)
3. On `tools/call` receiving 402 (payment required) — the wrapper automatically signs the payment with `BRIDGENODE_WALLET_KEY` and retries
4. Spending policy checks every payment BEFORE signing (fail-closed)

## Cost warning

This wrapper spends real USDC on every paid tool call (on-chain x402 micropayment). Check `list_models` for live prices first, set spending caps, and keep the wallet funded.
