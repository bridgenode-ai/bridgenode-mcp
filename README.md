# @bridgenode/mcp

[![npm version](https://img.shields.io/npm/v/@bridgenode/mcp.svg)](https://www.npmjs.com/package/@bridgenode/mcp)
[![npm downloads](https://img.shields.io/npm/dm/@bridgenode/mcp.svg)](https://www.npmjs.com/package/@bridgenode/mcp)
[![License: MIT-0](https://img.shields.io/badge/License-MIT--0-yellow.svg)](https://opensource.org/license/mit-0/)
[![Website](https://img.shields.io/badge/Website-bridgenode.cc-blue)](https://bridgenode.cc)
[![BridgeNode on x402-list](https://x402-list.com/badge/bridgenode.svg)](https://x402-list.com/services/bridgenode?utm_source=badge&utm_medium=referral&utm_campaign=embed)
[![Listed on MCP Registry](https://img.shields.io/badge/MCP%20Registry-Listed-7c3aed)](https://registry.modelcontextprotocol.io)

**Built for AI agents** — no API keys, no registration, pay-as-you-go with Solana USDC via x402.

BridgeNode MCP wrapper — stdio MCP server that proxies requests to the remote
`https://bridgenode.cc/mcp` (streamable-HTTP) with **automatic x402 payment**
(Solana USDC). No API keys, no registration.

## Installation (one-command)

```bash
claude mcp add bridgenode -s user -- npx -y @bridgenode/mcp@latest
```

Or manually (Claude Code, Cursor, other MCP clients):

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

## Configuration (.env)

```bash
# Solana wallet private key (base58) — agent's payment wallet
BRIDGENODE_WALLET_KEY=

# Spending policy (fail-closed)
BRIDGENODE_MAX_PER_CALL=0.05
BRIDGENODE_DAILY_CAP=1.0
```

## Tools

- `chat_completions` — AI inference (paid; x402 payment automatic)
- `list_models` — model list (free)
- `get_price_estimate` — estimate cost of a chat request (free)

## How it works

1. Local MCP client launches the wrapper via stdio
2. Wrapper connects to `https://bridgenode.cc/mcp` (streamable HTTP)
3. On `tools/call` receiving 402 (payment required) — the wrapper automatically
   signs the payment with `BRIDGENODE_WALLET_KEY` and retries the request
4. Spending policy checks every payment BEFORE signing (fail-closed)

## Links

- Website: https://bridgenode.cc
- Protocol: x402 V2 (docs.x402.org)
- npm: https://www.npmjs.com/package/@bridgenode/mcp

## Python packages

Prefer Python? The same BridgeNode toolkit is on PyPI:

- **Python SDK:** `pip install bridgenode-llm` → https://pypi.org/project/bridgenode-llm
- **CLI:** `pip install bridgenode-cli` → https://pypi.org/project/bridgenode-cli
- **Full toolkit (SDK + CLI):** `pip install bridgenode` → https://pypi.org/project/bridgenode
