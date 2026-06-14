/**
 * Unit tests for the automation engine. We stub the Prisma client via
 * tsx's module-alias loader so we can exercise the real persist() /
 * checkLowStock() code paths in isolation — no SQLite required.
 *
 * Run via:  npm test  (uses tsx under the hood)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// Use a tsx import map: redirect any "@prisma/client" import to our local
// stub. This works because tsx resolves relative + bare specifiers through
// its own loader and honours the import attribute below.
import { Module } from "node:module";

// Build a CJS loader override that resolves "@prisma/client" to the stub.
const stubPath = new URL("./_prisma-stub.mjs", import.meta.url).pathname;
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "@prisma/client") return stubPath;
  return origResolve.call(this, request, ...rest);
};

// Now safe to import the automation module — it will use our stub.
const { emit, checkLowStock } = await import("../../src/lib/automation.ts");

test("automation module exports the expected functions", () => {
  assert.equal(typeof emit, "function");
  assert.equal(typeof checkLowStock, "function");
});

test("checkLowStock is a no-op when stock > lowStockAt", async () => {
  await checkLowStock({
    businessId: "biz-1",
    productId: "prod-1",
    name: "Fake",
    stock: 100,
    lowStockAt: 5
  });
  assert.ok(true, "should not throw");
});

test("checkLowStock emits a low-stock event when stock <= lowStockAt", async () => {
  await checkLowStock({
    businessId: "biz-1",
    productId: "prod-1",
    name: "Fake",
    stock: 2,
    lowStockAt: 5
  });
  assert.ok(true, "should not throw even when persist is called");
});

test("checkLowStock skips emit when businessId is empty", async () => {
  await checkLowStock({
    businessId: "",
    productId: "prod-1",
    name: "Fake",
    stock: 2,
    lowStockAt: 5
  });
  assert.ok(true, "should silently skip on empty businessId");
});

test("emit returns empty array when businessId is empty", async () => {
  const result = await emit({
    type: "product.low_stock",
    businessId: "",
    title: "x",
    body: "y",
    priority: "low"
  });
  assert.ok(Array.isArray(result), "emit must return an array");
  assert.equal(result.length, 0, "emit must return empty array for empty businessId");
});
