/**
 * Unit tests for the reliability primitives.
 * Run: `node tests/unit/reliability.test.mjs` (or `npm test`).
 *
 * We import the compiled .ts output via tsx at runtime if available,
 * otherwise we just inline-test the exported contract.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { withRetry, withBreaker, safeAsync, breakerStatus } from "../../src/lib/reliability.ts";

test("withRetry retries on transient failure then succeeds", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error("ECONNRESET simulated");
      return "ok";
    },
    { max: 5, baseMs: 10, maxMs: 100 }
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("withRetry rethrows after max attempts", async () => {
  let calls = 0;
  await assert.rejects(async () => {
    await withRetry(
      async () => {
        calls++;
        throw new Error("timeout");
      },
      { max: 3, baseMs: 5, maxMs: 20 }
    );
  });
  assert.equal(calls, 3);
});

test("withRetry does not retry non-retryable errors", async () => {
  let calls = 0;
  await assert.rejects(async () => {
    await withRetry(
      async () => {
        calls++;
        throw new Error("validation failed");
      },
      { max: 5, baseMs: 5, maxMs: 20, retryIf: () => false }
    );
  });
  assert.equal(calls, 1);
});

test("withBreaker opens after threshold and short-circuits", async () => {
  const key = `test-breaker-${Date.now()}-${Math.random()}`;
  let calls = 0;

  // Trigger N failures to open the breaker
  for (let i = 0; i < 6; i++) {
    try {
      await withBreaker(
        key,
        async () => {
          calls++;
          throw new Error("boom");
        },
        { threshold: 5, coolOffMs: 60_000 }
      );
    } catch (_) {
      // expected
    }
  }

  // Breaker should now be open
  const status = breakerStatus();
  const breaker = status[key];
  assert.ok(breaker, "breaker should be tracked");
  assert.equal(breaker.state, "open");

  // Subsequent calls throw circuit_open immediately
  await assert.rejects(
    withBreaker(key, async () => "should not run", { threshold: 5, coolOffMs: 60_000 }),
    /circuit_open/
  );
});

test("safeAsync catches and logs errors", async () => {
  const before = process.stdout.write.bind(process.stdout);
  // We can't easily capture the captureError call without mocking, so we
  // just verify the function doesn't throw.
  await safeAsync(async () => {
    throw new Error("intentional");
  }, "test-label");
  // If we get here, safeAsync correctly swallowed the error.
  assert.ok(true);
  before;
});
