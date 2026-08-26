/**
 * spending.ts — BridgeNode MCP spending policy (fail-closed).
 *
 * Extracted from index.ts so the policy is unit-testable without
 * spawning the stdio server. Behavior is identical to the inline
 * logic it replaces:
 *
 * - Per-call cap: BRIDGENODE_MAX_PER_CALL (default 0.05 USD) — a single
 *   payment above this is blocked BEFORE the payment is made.
 * - Daily cap: BRIDGENODE_DAILY_CAP (default 1.0 USD) — cumulative spend
 *   is tracked per UTC day; spend is reserved on approval and recorded
 *   after a payment is actually submitted (settleResponse present).
 * - Fail-closed: any blocked payment returns an error reason (null = OK).
 */

export const USDC_DECIMALS = 6;

export const MAX_PER_CALL_USD = Number(process.env.BRIDGENODE_MAX_PER_CALL ?? 0.05);
export const DAILY_CAP_USD = Number(process.env.BRIDGENODE_DAILY_CAP ?? 1.0);

// Daily spend tracking (UTC day rollover).
let _spendDayUtc = "";
let _spentTodayUsd = 0;

/** YYYY-MM-DD (UTC) — the day key used for the daily cap rollover. */
export function dayKeyUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Reset the daily counter when the UTC day changes. */
export function rolloverIfNeeded(now: Date = new Date()): void {
  const today = dayKeyUtc(now);
  if (today !== _spendDayUtc) {
    _spendDayUtc = today;
    _spentTodayUsd = 0;
  }
}

/**
 * @internal Test-only: hard reset of the daily spend state.
 * Production code never calls this — unit tests use it for isolation.
 */
export function resetSpendState(): void {
  _spendDayUtc = "";
  _spentTodayUsd = 0;
}

/** Convert an atomic USDC amount (string, 6 decimals) to USD. */
export function amountUsdAtomic(amountAtomic: string | undefined): number {
  return Number(amountAtomic ?? 0) / 10 ** USDC_DECIMALS;
}

/** Record spend for a settled payment (idempotent per payment by caller). */
export function recordSpend(amountUsd: number): void {
  // P1-4: never poison the daily counter with NaN/negative (fail-closed).
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return;
  }
  rolloverIfNeeded();
  _spentTodayUsd += amountUsd;
}

/** Current spend today in USD (after rollover). */
export function spentTodayUsd(): number {
  rolloverIfNeeded();
  return _spentTodayUsd;
}

/**
 * Fail-closed spending policy check.
 *
 * Returns an error message when the payment must be blocked, or null when
 * it is allowed. Called BEFORE a payment is made (onPaymentRequested).
 */
export function allowPayment(amountUsd: number): string | null {
  // P1-4: fail-closed — NaN/negative/zero/Infinity must never pass
  // (`NaN > cap` is false → NaN would slip through the cap checks).
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return (
      `Payment ${amountUsd} USD is not a valid positive amount — blocked`
    );
  }
  if (amountUsd > MAX_PER_CALL_USD) {
    return (
      `Payment ${amountUsd} USD exceeds BRIDGENODE_MAX_PER_CALL ` +
      `(${MAX_PER_CALL_USD}) — blocked`
    );
  }
  rolloverIfNeeded();
  if (_spentTodayUsd + amountUsd > DAILY_CAP_USD) {
    return (
      `Payment ${amountUsd} USD would exceed BRIDGENODE_DAILY_CAP ` +
      `(${DAILY_CAP_USD}, spent today ${_spentTodayUsd.toFixed(4)}) — blocked`
    );
  }
  return null;
}
