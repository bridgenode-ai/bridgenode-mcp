# Changelog

## [1.0.9](https://github.com/bridgenode-ai/bridgenode-llm/compare/mcp-v1.0.8...mcp-v1.0.9) (2026-09-03)


### Bug Fixes

* **mcp:** short mcp_description (≤100 chars) for MCP registry publish ([0102267](https://github.com/bridgenode-ai/bridgenode-llm/commit/01022670217cd141f9f99972fca357219eea890f))

## [1.0.8](https://github.com/bridgenode-ai/bridgenode-llm/compare/mcp-v1.0.7...mcp-v1.0.8) (2026-09-03)


### Bug Fixes

* **mcp:** short mcp_description (≤100 chars) for MCP registry publish ([0102267](https://github.com/bridgenode-ai/bridgenode-llm/commit/01022670217cd141f9f99972fca357219eea890f))

## [1.0.7](https://github.com/bridgenode-ai/bridgenode-llm/compare/mcp-v1.0.6...mcp-v1.0.7) (2026-09-01)


### Bug Fixes

* **mcp:** reserve daily spend on approval — no race (C1) ([7362051](https://github.com/bridgenode-ai/bridgenode-llm/commit/73620512668d31180d52d622b397df4a2a5097aa))
* **mcp:** sync server.json description with config + CI drift check (V7) ([d2d0c1c](https://github.com/bridgenode-ai/bridgenode-llm/commit/d2d0c1c130a6f81b42998c40fae72b1a8d86ae04))
* **mcp:** use package.json version in Client/Server (fix.md 5.1) ([04a0129](https://github.com/bridgenode-ai/bridgenode-llm/commit/04a0129dd8686de3373b4a7c2e5a0f1d130c6585))
* **mcp:** validate spending env at load — fail-closed (C3) ([f777f16](https://github.com/bridgenode-ai/bridgenode-llm/commit/f777f16f99f327850f42177b0f50b31d28afe0ed))
* **mcp:** warn when 200 arrives without PAYMENT-RESPONSE receipt (C4) ([72112c3](https://github.com/bridgenode-ai/bridgenode-llm/commit/72112c3a493f3296a4ca560eb8618bc0da8d01b1))

## [1.0.6](https://github.com/bridgenode-ai/bridgenode-llm/compare/mcp-v1.0.5...mcp-v1.0.6) (2026-08-31)


### Bug Fixes

* **npm:** esbuild override ^0.28.1 — close GHSA (low, dev dep) ([b210e18](https://github.com/bridgenode-ai/bridgenode-llm/commit/b210e18845d827c00dc7645504a0af2136a5bf09))

## [1.0.5](https://github.com/bridgenode-ai/bridgenode-llm/compare/mcp-v1.0.4...mcp-v1.0.5) (2026-08-26)


### Bug Fixes

* **mcp:** declare @solana/transactions dependency (pnpm strict resolution) ([8af97e2](https://github.com/bridgenode-ai/bridgenode-llm/commit/8af97e2f7faf572b7571f293b32eb717e4435cd5))
* **mcp:** dotenv quiet — v17 prints tips to stdout, corrupts stdio MCP protocol ([cbb07bb](https://github.com/bridgenode-ai/bridgenode-llm/commit/cbb07bb51d5de316a38056ce61ddc9d40d9ad569))
* **mcp:** fail-closed spending policy — block NaN/negative/zero/Infinity amounts (P1-4) ([9451e3c](https://github.com/bridgenode-ai/bridgenode-llm/commit/9451e3c0e520b6fe46420852cc398a408f3f0df9))
* **mcp:** lazy payment signer — server starts without valid wallet key (Glama build test) ([ade1ae8](https://github.com/bridgenode-ai/bridgenode-llm/commit/ade1ae892e290ba69b2315fea2d476494591daa6))
* **release:** sync manifest versions + CI check-version-drift (P1-1) ([4e581ad](https://github.com/bridgenode-ai/bridgenode-llm/commit/4e581ad6a31641e5a83ac27251de27441801c918))
