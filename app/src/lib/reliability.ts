/**
 * ShopPilot AI — Reliability primitives.
 *
 *  - withRetry()  — exponential-backoff retry wrapper for transient failures
 *  - CircuitBreaker — fail-fast when a downstream is consistently broken
 *  - safeAsync() — fire-and-forget that never throws
 *
 * Prompt3 Phase 12: retry logic.
 * Prompt4 §3 (Reliability Engineering): retry mechanisms + circuit breakers
 *           + queue processing + failure recovery + graceful degradation.
 *
 * NOTE: This is intentionally dependency-free so the bundle stays small.
 * For a production multi-instance deploy, swap the in-memory `breakerState`
 * for a Redis-backed implementation.
 */

import { captureError, log } from "./monitoring";

// ---------- withRetry ----------

type RetryOpts = {
  max?: number;
  baseMs?: number;
  maxMs?: number;
  factor?: number;
  retryIf?: (e: unknown) => boolean;
  label?: string;
};

const TRANSIENT = (e: unknown) => {
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("network") ||
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("500")
  );
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {}
): Promise<T> {
  const max = opts.max ?? 3;
  const baseMs = opts.baseMs ?? 200;
  const maxMs = opts.maxMs ?? 4_000;
  const factor = opts.factor ?? 2;
  const shouldRetry = opts.retryIf ?? TRANSIENT;
  const label = opts.label ?? "withRetry";

  let lastErr: unknown;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === max - 1) break;
      if (!shouldRetry(e)) break;
      const delay = Math.min(maxMs, baseMs * Math.pow(factor, attempt)) * (0.5 + Math.random() * 0.5);
      log("warn", `${label} attempt ${attempt + 1} failed; retrying in ${Math.round(delay)}ms`, {
        err: e instanceof Error ? e.message : String(e)
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  captureError(`${label}_exhausted`, lastErr);
  throw lastErr;
}

// ---------- CircuitBreaker ----------

type BreakerState = {
  failures: number;
  openedAt: number;
  state: "closed" | "open" | "half-open";
};

const breakerState = new Map<string, BreakerState>();

type BreakerOpts = {
  threshold?: number;   // failures before opening
  coolOffMs?: number;   // time before half-open trial
  label?: string;
};

export async function withBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  opts: BreakerOpts = {}
): Promise<T> {
  const threshold = opts.threshold ?? 5;
  const coolOffMs = opts.coolOffMs ?? 30_000;
  const label = opts.label ?? key;

  const now = Date.now();
  const cur = breakerState.get(key) ?? { failures: 0, openedAt: 0, state: "closed" as const };

  if (cur.state === "open") {
    if (now - cur.openedAt > coolOffMs) {
      cur.state = "half-open";
    } else {
      throw new Error(`circuit_open:${key}`);
    }
  }

  try {
    const result = await fn();
    // success → reset
    cur.failures = 0;
    cur.state = "closed";
    cur.openedAt = 0;
    breakerState.set(key, cur);
    return result;
  } catch (e) {
    cur.failures += 1;
    if (cur.failures >= threshold) {
      cur.state = "open";
      cur.openedAt = now;
      log("error", `circuit_opened:${key} after ${cur.failures} failures`, { label });
    }
    breakerState.set(key, cur);
    throw e;
  }
}

/** For tests / status endpoints. */
export function breakerStatus(): Record<string, BreakerState> {
  return Object.fromEntries(breakerState.entries());
}

// ---------- safeAsync ----------

/**
 * Fire-and-forget wrapper. Never throws.
 * Use it for non-critical side effects like analytics events.
 */
export function safeAsync(fn: () => Promise<unknown>, label = "safeAsync"): void {
  fn().catch((e) => {
    captureError(label, e);
  });
}
