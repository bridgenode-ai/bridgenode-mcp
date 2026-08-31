# Changelog

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
