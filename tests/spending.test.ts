/**
 * spending.test.ts — unit tests for the MCP spending policy (fail-closed).
 *
 * Mock tests: no network, no real payments. Covers the exact policy used
 * by the wrapper before every payment:
 *   - per-call cap (BRIDGENODE_MAX_PER_CALL, default 0.05 USD)
 *   - daily cap (BRIDGENODE_DAILY_CAP, default 1.0 USD, UTC rollover)
 *   - amount conversion (atomic USDC → USD)
 */

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  USDC_DECIMALS,
  MAX_PER_CALL_USD,
  DAILY_CAP_USD,
  allowPayment,
  amountUsdAtomic,
  recordSpend,
  releaseSpendReservation,
  spentTodayUsd,
  rolloverIfNeeded,
  resetSpendState,
} from "../src/spending.js";

// Isolate tests: spending.ts keeps module state (daily counter), so reset
// it before every test.
beforeEach(() => {
  resetSpendState();
});

test("USDC_DECIMALS is 6 (atomic units)", () => {
  assert.equal(USDC_DECIMALS, 6);
});

test("defaults are fail-closed: 0.05 per call, 1.0 per day", () => {
  assert.equal(MAX_PER_CALL_USD, 0.05);
  assert.equal(DAILY_CAP_USD, 1.0);
});

test("C3: garbage env values fall back to defaults (fail-closed)", async () => {
  // Env is read at module load — verify in a subprocess with garbage values:
  // Number("abc") → NaN would disable both caps silently (fail-open); the
  // fix validates at load and falls back to the defaults.
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);

  const script = `
    import { MAX_PER_CALL_USD, DAILY_CAP_USD, allowPayment } from "./src/spending.ts";
    console.log(JSON.stringify({ max: MAX_PER_CALL_USD, cap: DAILY_CAP_USD, blocked: allowPayment(0.5) }));
  `;
  const { stdout } = await run(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", script],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BRIDGENODE_MAX_PER_CALL: "abc",
        BRIDGENODE_DAILY_CAP: "0,05",  // comma typo — also garbage
      },
    },
  );
  const out = JSON.parse(stdout.trim().split(/\n/).pop()!);
  // Defaults restored — the 0.5 USD payment is blocked (per-call cap 0.05)
  assert.equal(out.max, 0.05);
  assert.equal(out.cap, 1.0);
  assert.ok(out.blocked !== null);
  assert.match(out.blocked, /exceeds BRIDGENODE_MAX_PER_CALL/);
});

test("amountUsdAtomic converts atomic USDC to USD", () => {
  assert.equal(amountUsdAtomic("2000"), 0.002);
  assert.equal(amountUsdAtomic("1000000"), 1.0);
  assert.equal(amountUsdAtomic("1234567"), 1.234567);
  assert.equal(amountUsdAtomic(undefined), 0);
  assert.equal(amountUsdAtomic(""), 0);
  assert.ok(Number.isNaN(amountUsdAtomic("abc")));
});

test("allowPayment: payment at/under per-call cap is allowed", () => {
  assert.equal(allowPayment(0.05), null);
  assert.equal(allowPayment(0.001), null);
});

test("allowPayment: NaN/negative/zero/Infinity are blocked (P1-4)", () => {
  // `NaN > cap` is false → without the isFinite guard NaN would slip through.
  assert.ok(allowPayment(Number.NaN) !== null);
  assert.ok(allowPayment(-0.01) !== null);
  assert.ok(allowPayment(0) !== null);
  assert.ok(allowPayment(Number.POSITIVE_INFINITY) !== null);
  assert.ok(allowPayment(Number.NEGATIVE_INFINITY) !== null);
});

test("recordSpend: NaN/negative never poison the counter (P1-4)", () => {
  assert.equal(spentTodayUsd(), 0);
  recordSpend(Number.NaN);
  recordSpend(-5);
  recordSpend(0);
  recordSpend(Number.POSITIVE_INFINITY);
  assert.equal(spentTodayUsd(), 0);

  // Valid spend still records normally.
  recordSpend(0.05);
  assert.ok(Math.abs(spentTodayUsd() - 0.05) < 1e-9, `got ${spentTodayUsd()}`);
});

test("allowPayment: payment above per-call cap is blocked", () => {
  const reason = allowPayment(0.051);
  assert.ok(reason !== null);
  assert.match(reason!, /exceeds BRIDGENODE_MAX_PER_CALL/);
});

test("allowPayment + recordSpend: daily cap accumulates and blocks", () => {
  assert.equal(spentTodayUsd(), 0);

  // Spend 0.04 × 24 = 0.96 of the 1.0 daily cap (each below per-call 0.05)
  for (let i = 0; i < 24; i++) {
    assert.equal(allowPayment(0.04), null);
    recordSpend(0.04);
  }
  assert.ok(Math.abs(spentTodayUsd() - 0.96) < 1e-9, `got ${spentTodayUsd()}`);

  // 0.05 more would exceed 1.0 → blocked (daily cap)
  const reason = allowPayment(0.05);
  assert.ok(reason !== null);
  assert.match(reason!, /exceed BRIDGENODE_DAILY_CAP/);

  // 0.03 more keeps us under the cap → allowed (avoids the exact 1.0
  // float boundary: 0.96 + 0.04 = 1.0000000000000003 > 1.0)
  assert.equal(allowPayment(0.03), null);
  recordSpend(0.03);
  assert.ok(Math.abs(spentTodayUsd() - 0.99) < 1e-9, `got ${spentTodayUsd()}`);

  // 0.02 more would exceed 1.0 → blocked
  assert.ok(allowPayment(0.02) !== null);
});

test("spending persists within the same UTC day", () => {
  recordSpend(0.7);
  assert.equal(spentTodayUsd(), 0.7);

  // Same day: no reset, counter persists
  rolloverIfNeeded();
  assert.equal(spentTodayUsd(), 0.7);
});

test("spending resets on UTC day rollover", () => {
  // Force the internal day key to a fixed date and spend on that day.
  rolloverIfNeeded(new Date("2026-01-01T12:00:00Z"));
  recordSpend(0.7);
  assert.equal(spentTodayUsd(), 0.7);

  // Next UTC day → rollover resets the counter.
  rolloverIfNeeded(new Date("2026-01-02T12:00:00Z"));
  assert.equal(spentTodayUsd(), 0);
});

test("C1: reservation on approval blocks a concurrent call over the cap", () => {
  // Simulates two parallel tool calls: the first passes allowPayment and
  // RESERVES its spend synchronously (before the network round-trip); the
  // second must then be blocked by the daily cap even though the first
  // payment has not settled yet.
  resetSpendState();

  // First call: approved + reserved on approval — 24 × 0.04 = 0.96 of the
  // 1.0 daily cap (each below the 0.05 per-call cap).
  for (let i = 0; i < 24; i++) {
    assert.equal(allowPayment(0.04), null);
    recordSpend(0.04);  // reserve on approval (C1)
  }
  assert.ok(Math.abs(spentTodayUsd() - 0.96) < 1e-9,
            `got ${spentTodayUsd()}`);

  // Second parallel call arrives before the first settles: 0.96 + 0.05 > 1.0
  // → blocked by the daily cap (reservation alone, nothing settled yet).
  const reason = allowPayment(0.05);
  assert.ok(reason !== null);
  assert.match(reason!, /exceed BRIDGENODE_DAILY_CAP/);
});

test("C1: releaseSpendReservation frees the cap when receipt not confirmed", () => {
  resetSpendState();

  // Reserved on approval, then the receipt failed to verify → release.
  assert.equal(allowPayment(0.04), null);
  recordSpend(0.04);
  assert.ok(Math.abs(spentTodayUsd() - 0.04) < 1e-9);
  releaseSpendReservation(0.04);
  assert.equal(spentTodayUsd(), 0);

  // Cap is usable again for the retry.
  assert.equal(allowPayment(0.04), null);

  // Never goes negative / ignores garbage (P1-4 fail-closed).
  releaseSpendReservation(Number.NaN);
  releaseSpendReservation(-5);
  releaseSpendReservation(0);
  releaseSpendReservation(Number.POSITIVE_INFINITY);
  assert.equal(spentTodayUsd(), 0);
});
