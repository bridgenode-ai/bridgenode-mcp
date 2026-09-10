# Changelog

## [1.0.14](https://github.com/bridgenode-ai/bridgenode-llm/compare/mcp-v1.0.13...mcp-v1.0.14) (2026-09-10)


### Bug Fixes

* **mcp:** point a wallet-less agent at the free path ([a46d371](https://github.com/bridgenode-ai/bridgenode-llm/commit/a46d371a60449eea88f13e8e92780cb3c8076ff0))

## [1.0.13](https://github.com/bridgenode-ai/bridgenode-llm/compare/mcp-v1.0.12...mcp-v1.0.13) (2026-09-10)


### Bug Fixes

* **server:** serve DeepSeek V4.1 Flash under its official id (deepseek-flash) ([38ab6e3](https://github.com/bridgenode-ai/bridgenode-llm/commit/38ab6e3d6f9af9d78c467465212370205e8b1af3))

## [1.0.12](https://github.com/bridgenode-ai/bridgenode-llm/compare/mcp-v1.0.11...mcp-v1.0.12) (2026-09-08)


### Bug Fixes

* **mcp:** emit type declarations via tsc, typescript 7 ([680e6b1](https://github.com/bridgenode-ai/bridgenode-llm/commit/680e6b165689dfa4c11ac2627a12a7b310b5bbae))

## [1.0.11](https://github.com/bridgenode-ai/bridgenode-llm/compare/mcp-v1.0.10...mcp-v1.0.11) (2026-09-07)


### Bug Fixes

* **glama:** maintainers use GitHub username (BridgeNode-cc) for claim ([9598ef6](https://github.com/bridgenode-ai/bridgenode-llm/commit/9598ef6d29a2a875373d48f91b2b5bb02c6a3db3))

## [1.0.10](https://github.com/bridgenode-ai/bridgenode-llm/compare/mcp-v1.0.9...mcp-v1.0.10) (2026-09-06)


### Bug Fixes

* **deps:** mcp [@x402](https://github.com/x402) 2.25.0 + @types/node 26.4.1 ([781b1a8](https://github.com/bridgenode-ai/bridgenode-llm/commit/781b1a8e6d630eba4423ae1ff4001db9b6594c4a))

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
