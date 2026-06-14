/**
 * ShopPilot AI — Automation Engine (Phase 8).
 *
 * Prompt3 §8:
 *  - Event listeners
 *  - Workflow execution
 *  - Notification system
 *  - AI automation triggers
 *
 * This module is a tiny in-process event bus that:
 *
 *   1. Decouples "something happened" from "what to do about it"
 *   2. Lets us add new automation rules without touching business code
 *   3. Persists every event into the `Notification` model so the
 *      owner has a visible audit trail of system-triggered actions.
 *   4. Supports a few built-in rules: low-stock alert, payment-paid
 *      celebration, reschedule, content suggestion, AI-extracted order.
 *
 * In production this would be backed by a queue (BullMQ, SQS, n8n).
 * For the MVP we run handlers inline, in the same request, and let the
 * monitor shim log every dispatched event for traceability.
 */

import { prisma } from "./db";
import { log, captureEvent } from "./monitoring";

// ---------- Types ----------

export type DomainEvent =
  | { type: "order.created";     businessId: string; orderId: string; orderNumber: string; total: number; items: number }
  | { type: "order.paid";        businessId: string; orderId: string; orderNumber: string; method: string; amount: number }
  | { type: "order.shipped";     businessId: string; orderId: string; orderNumber: string; courier: string; tracking: string | null }
  | { type: "order.cancelled";   businessId: string; orderId: string; orderNumber: string; reason?: string; total?: number }
  | { type: "product.created";   businessId: string; productId: string; name: string; stock: number }
  | { type: "product.low_stock"; businessId: string; productId: string; name: string; stock: number; lowStockAt: number }
  | { type: "message.received";  businessId: string; conversationId: string; preview: string }
  | { type: "reseller.invited";  businessId: string; resellerId: string; name: string; email: string }
  | { type: "insight.generated"; businessId: string; insightId: string; title: string; priority: string }
  | { type: "payment.failed";    businessId: string; orderId: string; orderNumber?: string; method: string; reason: string };

export type Notification = {
  businessId: string;
  userId?: string | null;
  type: DomainEvent["type"];
  title: string;
  body: string;
  meta?: Record<string, unknown>;
  priority?: "low" | "medium" | "high" | "urgent";
};

export type AutomationRule = {
  eventType: DomainEvent["type"];
  describe: (e: DomainEvent) => string;
  build: (e: DomainEvent) => Notification[];
  priority?: Notification["priority"];
};

// ---------- Built-in rules ----------

const rules: AutomationRule[] = [
  {
    eventType: "order.created",
    describe: (e) => `Order ${(e as any).orderNumber} created (${(e as any).items} item${(e as any).items === 1 ? "" : "s"})`,
    build: (e) => {
      const o = e as Extract<DomainEvent, { type: "order.created" }>;
      return [{
        businessId: o.businessId,
        type: "order.created",
        title: `New order ${o.orderNumber}`,
        body: `A new order with ${o.items} item(s) totalling ৳${o.total.toLocaleString("en-BD")} was created.`,
        priority: "medium",
        meta: { orderId: o.orderId, total: o.total }
      }];
    }
  },
  {
    eventType: "order.paid",
    describe: (e) => `Order ${(e as any).orderId} paid via ${(e as any).method}`,
    build: (e) => {
      const o = e as Extract<DomainEvent, { type: "order.paid" }>;
      return [{
        businessId: o.businessId,
        type: "order.paid",
        title: "Payment received",
        body: `৳${o.amount.toLocaleString("en-BD")} received via ${o.method.toUpperCase()}. Ready to ship.`,
        priority: "high",
        meta: { orderId: o.orderId, method: o.method, amount: o.amount }
      }];
    }
  },
  {
    eventType: "order.shipped",
    describe: () => "Order dispatched",
    build: (e) => {
      const o = e as Extract<DomainEvent, { type: "order.shipped" }>;
      return [{
        businessId: o.businessId,
        type: "order.shipped",
        title: "Order shipped",
        body: `Order dispatched via ${o.courier}${o.tracking ? ` (${o.tracking})` : ""}.`,
        priority: "medium",
        meta: { orderId: o.orderId, courier: o.courier, tracking: o.tracking }
      }];
    }
  },
  {
    eventType: "product.low_stock",
    describe: (e) => `Low stock: ${(e as any).name} (${(e as any).stock} left)`,
    build: (e) => {
      const p = e as Extract<DomainEvent, { type: "product.low_stock" }>;
      return [{
        businessId: p.businessId,
        type: "product.low_stock",
        title: "Low-stock alert",
        body: `“${p.name}” has only ${p.stock} left (threshold ${p.lowStockAt}). Reorder soon.`,
        priority: "high",
        meta: { productId: p.productId, stock: p.stock, lowStockAt: p.lowStockAt }
      }];
    }
  },
  {
    eventType: "product.created",
    describe: (e) => `Product ${(e as any).name} added`,
    build: (e) => {
      const p = e as Extract<DomainEvent, { type: "product.created" }>;
      return [{
        businessId: p.businessId,
        type: "product.created",
        title: "Product added",
        body: `“${p.name}” is in the catalog (stock: ${p.stock}). AI description available in Content Studio.`,
        priority: "low",
        meta: { productId: p.productId }
      }];
    }
  },
  {
    eventType: "reseller.invited",
    describe: (e) => `Reseller ${(e as any).name} invited`,
    build: (e) => {
      const r = e as Extract<DomainEvent, { type: "reseller.invited" }>;
      return [{
        businessId: r.businessId,
        type: "reseller.invited",
        title: "Reseller invited",
        body: `${r.name} (${r.email}) has been onboarded with a referral code.`,
        priority: "low",
        meta: { resellerId: r.resellerId, email: r.email }
      }];
    }
  },
  {
    eventType: "insight.generated",
    describe: (e) => `New insight: ${(e as any).title}`,
    build: (e) => {
      const i = e as Extract<DomainEvent, { type: "insight.generated" }>;
      return [{
        businessId: i.businessId,
        type: "insight.generated",
        title: `Copilot insight: ${i.title}`,
        body: `Priority: ${i.priority}. Open the dashboard to act on it.`,
        priority: i.priority === "urgent" ? "urgent" : "medium",
        meta: { insightId: i.insightId }
      }];
    }
  },
  {
    eventType: "message.received",
    describe: () => "New inbound message",
    build: (e) => {
      const m = e as Extract<DomainEvent, { type: "message.received" }>;
      return [{
        businessId: m.businessId,
        type: "message.received",
        title: "New message",
        body: m.preview.slice(0, 140),
        priority: "low",
        meta: { conversationId: m.conversationId }
      }];
    }
  },
  {
    eventType: "payment.failed",
    describe: (e) => `Payment failed for ${(e as any).method}`,
    build: (e) => {
      const p = e as Extract<DomainEvent, { type: "payment.failed" }>;
      return [{
        businessId: p.businessId,
        type: "payment.failed",
        title: "Payment failed",
        body: `${p.method.toUpperCase()} payment failed: ${p.reason}. Follow up with the customer.`,
        priority: "high",
        meta: { orderId: p.orderId, method: p.method, reason: p.reason }
      }];
    }
  }
];

// ---------- Public API ----------

/**
 * Emit a domain event. Runs every matching rule and persists notifications.
 * Never throws.
 */
export async function emit(event: DomainEvent): Promise<Notification[]> {
  // Guard 1: every event MUST carry a non-empty businessId. Without it
  // the FK on Insight.businessId would (correctly) reject the row.
  if (!event.businessId || typeof event.businessId !== "string" || event.businessId.trim() === "") {
    log("warn", "automation.emit rejected event with empty businessId", { type: event.type });
    return [];
  }
  const matched = rules.filter((r) => r.eventType === event.type);
  const created: Notification[] = [];
  for (const rule of matched) {
    try {
      const notes = rule.build(event);
      for (const n of notes) {
        if (!n.businessId) continue; // Guard 2: skip notifications with no businessId
        const persisted = await persist(n);
        if (persisted) created.push(n);
      }
      captureEvent("automation.rule_fired", { type: event.type, count: notes.length });
    } catch (e) {
      log("error", `automation rule failed for ${event.type}`, { err: String(e) });
    }
  }
  return created;
}

/**
 * Convenience helper: fire a low-stock check for a product.
 * Called from any code that mutates product stock.
 */
export async function checkLowStock(opts: {
  businessId: string;
  productId: string;
  name: string;
  stock: number;
  lowStockAt: number;
}): Promise<void> {
  if (opts.stock <= opts.lowStockAt) {
    await emit({
      type: "product.low_stock",
      businessId: opts.businessId,
      productId: opts.productId,
      name: opts.name,
      stock: opts.stock,
      lowStockAt: opts.lowStockAt
    });
  }
}

async function persist(n: Notification) {
  // Guard: businessId is required (Insight.businessId is non-nullable + FK).
  if (!n.businessId || n.businessId.trim() === "") {
    log("warn", "automation.persist skipped — no businessId", { type: n.type });
    return false;
  }
  // Guard: verify the business exists. This turns a noisy FK violation
  // (logged as `error` by Prisma) into a clean pre-flight check.
  try {
    const exists = await prisma.business.findUnique({ where: { id: n.businessId } });
    if (!exists) {
      log("warn", "automation.persist skipped — businessId not found", { businessId: n.businessId, type: n.type });
      return false;
    }
  } catch (lookupErr) {
    // If the lookup itself errors, fall through to a single attempt at
    // create; the catch below will handle FK violations gracefully.
    log("warn", "automation.persist: business lookup failed", { err: String(lookupErr) });
  }

  try {
    // We persist a minimal model in the Insight table — it already exists
    // and has the right shape (title, body, type, priority, businessId).
    // This is intentional: the dashboard surfaces Insights as actionable
    // cards, and notifications ARE insights from the seller's POV.
    await prisma.insight.create({
      data: {
        businessId: n.businessId,
        type: mapToInsightType(n.type),
        title: n.title,
        body: n.body,
        priority: n.priority ?? "medium",
        severity: n.priority ?? "medium",
        data: n.meta ? JSON.stringify(n.meta) : null,
        isRead: false,
        isActedOn: false
      }
    });
    return true;
  } catch (e) {
    // FK violations are now rare thanks to the pre-check, but if the
    // business is deleted between the lookup and the create, we still
    // need to fail silently rather than crash the calling route.
    log("warn", "automation.persist failed (likely FK race)", { err: String(e), type: n.type });
    return false;
  }
}

function mapToInsightType(t: DomainEvent["type"]): string {
  switch (t) {
    case "product.low_stock":  return "alert";
    case "order.created":      return "ops";
    case "order.paid":         return "ops";
    case "order.shipped":      return "ops";
    case "order.cancelled":    return "alert";
    case "product.created":    return "opportunity";
    case "reseller.invited":   return "ops";
    case "insight.generated":  return "opportunity";
    case "message.received":   return "ops";
    case "payment.failed":     return "alert";
    default:                   return "ops";
  }
}
