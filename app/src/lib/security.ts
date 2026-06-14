// ShopPilot AI — Security & reliability layer.
//
// Three concerns live here:
//   1. Input validation   — Zod schemas for every API body
//   2. Prompt-injection   — detect and neutralise hostile user input before it
//                            reaches an LLM system prompt
//   3. Rate limiting      — per-(user, route) sliding-window in-memory limiter
//   4. Audit logging      — write a row to the AuditLog table for any
//                            mutating or AI-using endpoint
//
// The limiter is process-local (sufficient for one Next.js instance). To run
// multi-instance, swap `bucket.incr` for a Redis INCR.

import { z } from "zod";
import { prisma } from "./db";
import { NextRequest, NextResponse } from "next/server";

// ---------- 1. INPUT VALIDATION ----------

export const Schemas = {
  // Matches lib/ai-client.ts::generateProductDescription
  productDescription: z.object({
    name: z.string().min(1).max(200),
    category: z.string().max(80).optional(),
    features: z.string().max(800).optional(),
    tone: z.string().max(60).optional()
  }),
  // Matches lib/ai-client.ts::generateFacebookPost
  facebookPost: z.object({
    productId: z.string().max(60).optional(),
    topic: z.string().min(1).max(500),
    tone: z.string().max(60).optional()
  }),
  // Matches lib/ai-client.ts::generateCampaign
  campaign: z.object({
    goal: z.string().min(1).max(200),
    budget: z.number().nonnegative().max(10_000_000),
    audience: z.string().min(1).max(200)
  }),
  // Matches lib/ai-client.ts::translateText
  translate: z.object({
    text: z.string().min(1).max(2000),
    target: z.enum(["bn", "en"])
  }),
  // Matches lib/ai-client.ts::askCopilot
  copilot: z.object({
    question: z.string().min(3).max(1000)
  }),
  // Server-side: caller passes the last inbound message
  suggestReplies: z.object({
    message: z.string().min(1).max(2000)
  }),
  extractOrder: z.object({
    message: z.string().min(1).max(2000)
  }),
  // Conversation message body
  message: z.object({
    content: z.string().min(1).max(4000).optional(),
    body: z.string().min(1).max(4000).optional()
  }).refine((b) => Boolean(b.content || b.body), { message: "content or body required" }),

  // ---- Commerce write schemas ----
  // POST /api/products
  product: z.object({
    name: z.string().min(1).max(200),
    category: z.string().max(80).optional().nullable(),
    price: z.number().nonnegative().max(10_000_000),
    cost: z.number().nonnegative().max(10_000_000).optional(),
    costPrice: z.number().nonnegative().max(10_000_000).optional(),
    stock: z.number().int().min(0).max(1_000_000),
    lowStockAt: z.number().int().min(0).max(1_000_000).optional(),
    sku: z.string().max(80).optional().nullable(),
    description: z.string().max(4000).optional().nullable(),
    active: z.boolean().optional(),
    status: z.string().max(40).optional()
  }),

  // POST /api/orders  — natural language order extractor
  orderCreate: z.object({
    chat: z.string().min(1).max(4000),
    channel: z.string().max(40).optional(),
    customerPhone: z.string().max(40).optional(),
    customerName: z.string().max(200).optional(),
    customerCity: z.string().max(120).optional()
  }),

  // PATCH /api/orders/[id]
  orderUpdate: z.object({
    status: z.string().max(40).optional(),
    paymentStatus: z.string().max(40).optional(),
    fulfillmentStatus: z.string().max(40).optional(),
    notes: z.string().max(2000).optional(),
    trackingCode: z.string().max(200).optional(),
    dispatch: z.boolean().optional(),
    courier: z.string().max(40).optional()
  }),

  // POST /api/resellers/invite
  resellerInvite: z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(200),
    phone: z.string().max(40).optional().nullable(),
    city: z.string().max(120).optional().nullable(),
    tier: z.enum(["bronze", "silver", "gold"]).optional(),
    commissionType: z.enum(["percentage", "fixed"]).optional(),
    commissionValue: z.number().nonnegative().max(100).optional(),
    commissionRate: z.number().nonnegative().max(100).optional()
  }),

  // POST /api/integrations/bkash
  bkash: z.object({
    action: z.enum(["create", "verify"]),
    amount: z.number().positive().max(10_000_000).optional(),
    invoiceNumber: z.string().max(80).optional(),
    customerPhone: z.string().max(40).optional(),
    paymentId: z.string().max(200).optional(),
    orderId: z.string().max(60).optional()
  }).refine(
    (b) => b.action === "create"
      ? (b.amount != null && b.amount > 0)
      : (b.paymentId != null && b.paymentId.length > 0),
    { message: "create requires amount; verify requires paymentId" }
  ),

  // POST /api/insights  — force a refresh
  insightsGenerate: z.object({
    force: z.boolean().optional()
  }).optional().default({ force: false } as any)
};

export function parseBody<T>(schema: z.ZodType<T>, raw: unknown):
  | { ok: true; data: T }
  | { ok: false; res: NextResponse } {
  const r = schema.safeParse(raw);
  if (!r.success) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "invalid_input", issues: r.error.issues.slice(0, 5) },
        { status: 400 }
      )
    };
  }
  return { ok: true, data: r.data };
}

// ---------- 2. PROMPT-INJECTION GUARD ----------
//
// Heuristics that catch the most common attacks:
//   - "ignore previous instructions"
//   - "you are now …"
//   - role/system override tokens (<|...|>, [INST], <<SYS>>)
//   - attempts to exfiltrate the system prompt
//
// We do NOT try to be perfect — we layer this on top of the LLM's own
// guardrails. The goal is to fail closed on obvious attacks and to log the
// attempt so we can review it.

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all )?(?:previous|prior|above) (?:instructions|prompts?|directives?)/i,
  /disregard (?:the )?(?:previous|prior|above)/i,
  /you (?:are|'re) now (?:a |an )?/i,
  /(?:^|\n)\s*system\s*:/i,
  /<\|\s*(?:im_start|system|endoftext)\s*\|>/i,
  /\[\s*INST\s*\]/i,
  /<<\s*SYS\s*>>/i,
  /reveal (?:your|the) (?:system|initial|hidden) prompt/i,
  /forget everything (?:above|before|you'?ve been told)/i,
  /act as (?:a |an )?(?:developer|admin|root|godmode)/i
];

export type SanitizeResult = { safe: boolean; cleaned: string; reason?: string };

export function sanitizeForPrompt(input: string): SanitizeResult {
  if (typeof input !== "string") return { safe: true, cleaned: String(input ?? "") };

  for (const pat of INJECTION_PATTERNS) {
    if (pat.test(input)) {
      // Strip the offending line(s) and warn in the audit log later.
      const cleaned = input
        .split(/\r?\n/)
        .filter((l) => !pat.test(l))
        .join("\n")
        .slice(0, 4000);
      return { safe: false, cleaned, reason: `matched: ${pat.source}` };
    }
  }
  return { safe: true, cleaned: input.slice(0, 4000) };
}

// ---------- 3. RATE LIMITING ----------
//
// Simple sliding-window counter, keyed by (userId, bucket).  Defaults:
//   - AI endpoints:    30 req / minute
//   - Write endpoints: 60 req / minute
//   - Read endpoints: 120 req / minute
//
// In dev this lives in process memory. In production, replace the Map with
// a Redis client (`@upstash/ratelimit` or similar).

type Bucket = { hits: number[] };
const store = new Map<string, Bucket>();

function key(userId: string, bucket: string) {
  return `${userId}::${bucket}`;
}

export type RateOpts = { windowMs?: number; max?: number };

export function rateLimit(userId: string, bucket: string, opts: RateOpts = {}): {
  ok: boolean; remaining: number; resetMs: number;
} {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 60;
  const k = key(userId, bucket);
  const now = Date.now();
  const b = store.get(k) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= max) {
    const oldest = b.hits[0];
    return { ok: false, remaining: 0, resetMs: windowMs - (now - oldest) };
  }
  b.hits.push(now);
  store.set(k, b);
  return { ok: true, remaining: max - b.hits.length, resetMs: windowMs };
}

export function rlHeaders(info: { remaining: number; resetMs: number }) {
  return {
    "X-RateLimit-Remaining": String(info.remaining),
    "X-RateLimit-Reset": String(Math.ceil(info.resetMs / 1000))
  };
}

// ---------- 4. AUDIT LOG ----------
//
// A lightweight row written from mutating/AI endpoints. We keep it
// best-effort: a failure here must NOT break the request.

export type AuditAction =
  | "ai.product_description"
  | "ai.facebook_post"
  | "ai.campaign"
  | "ai.translate"
  | "ai.copilot"
  | "ai.suggest_replies"
  | "ai.extract_order"
  | "order.create"
  | "order.update"
  | "order.read"
  | "order.read_one"
  | "order.dedup_hit"
  | "order.create_blocked"
  | "payment.bkash_create"
  | "product.create"
  | "product.update"
  | "product.read"
  | "reseller.invite"
  | "message.send"
  | "insights.read"
  | "insights.generate"
  | "analytics.read"
  | "auth.login"
  | "security.injection_blocked";

export async function audit(opts: {
  businessId?: string | null;
  userId?: string | null;
  action: AuditAction;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: opts.businessId ?? undefined,
        userId: opts.userId ?? undefined,
        action: opts.action,
        meta: opts.meta ? JSON.stringify(opts.meta) : null,
        ip: opts.ip ?? null
      }
    });
  } catch {
    // never let auditing break the user request
  }
}

// ---------- 5. CONVENIENCE GUARD ----------
//
// The pattern every API route follows:
//
//   const guard = await protectRoute(req, "ai.product_description", Schemas.x);
//   if (!guard.ok) return guard.res;
//   const { session, body, businessId, userId } = guard;
//
// It handles auth + validation + rate limit + sanitization in one call.
//
// `requireAuth` is the same but without body parsing — for GET/DELETE/HEAD
// endpoints that have no body to validate.

export async function protectRoute<T>(
  req: NextRequest,
  action: AuditAction,
  schema: z.ZodType<T>,
  opts: { rlMax?: number; rlWindowMs?: number; requireAuth?: boolean } = {}
): Promise<
  | { ok: true; session: any; body: T; businessId: string; userId: string; cleaned: T }
  | { ok: false; res: NextResponse }
> {
  // We import lazily to avoid a circular dep with lib/auth.
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("./auth");
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const businessId = (session.user as any).businessId as string;
  const userId = (session.user as any).id as string;
  if (!businessId) {
    return { ok: false, res: NextResponse.json({ error: "no_business" }, { status: 403 }) };
  }

  const raw = await req.json().catch(() => null);
  const parsed = parseBody(schema, raw);
  if (!parsed.ok) return { ok: false, res: parsed.res };

  // Rate limit by userId + action
  const rl = rateLimit(userId, action, {
    max: opts.rlMax ?? 30,
    windowMs: opts.rlWindowMs ?? 60_000
  });
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: "rate_limited", retryAfterMs: rl.resetMs },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(Math.ceil(rl.resetMs / 1000)));
    return { ok: false, res };
  }

  // Sanitise any string-typed field that will be folded into a prompt
  const cleaned = sanitiseObject(parsed.data) as T;

  // If any field tripped the injection guard, log + audit
  const tripped = (cleaned as any).__injectionFlags as string[] | undefined;
  if (tripped && tripped.length > 0) {
    await audit({
      businessId,
      userId,
      action: "security.injection_blocked",
      meta: { route: action, flags: tripped }
    });
  }

  // Best-effort audit trail for the action itself
  await audit({ businessId, userId, action });

  return { ok: true, session, body: parsed.data, businessId, userId, cleaned };
}

function sanitiseObject<T>(obj: T): T {
  if (typeof obj === "string") {
    const r = sanitizeForPrompt(obj);
    return r.cleaned as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => sanitiseObject(v)) as unknown as T;
  }
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    const flags: string[] = (obj as any).__injectionFlags ?? [];
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") {
        const r = sanitizeForPrompt(v);
        if (!r.safe) flags.push(`${k}: ${r.reason ?? "blocked"}`);
        out[k] = r.cleaned;
      } else {
        out[k] = sanitiseObject(v);
      }
    }
    if (flags.length) (out as any).__injectionFlags = flags;
    return out as T;
  }
  return obj;
}

// ---------- 6. AUTH-ONLY GUARD (no body) ----------
//
// For GET / DELETE / HEAD endpoints. Same auth + rate limit + audit
// behaviour as `protectRoute` but skips the JSON body parse.

export async function requireAuth(
  _req: NextRequest,
  action: AuditAction,
  opts: { rlMax?: number; rlWindowMs?: number } = {}
): Promise<
  | { ok: true; session: any; businessId: string; userId: string }
  | { ok: false; res: NextResponse }
> {
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("./auth");
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const businessId = (session.user as any).businessId as string;
  const userId = (session.user as any).id as string;
  if (!businessId) {
    return { ok: false, res: NextResponse.json({ error: "no_business" }, { status: 403 }) };
  }

  const rl = rateLimit(userId, action, {
    max: opts.rlMax ?? 60,
    windowMs: opts.rlWindowMs ?? 60_000
  });
  if (!rl.ok) {
    const res = NextResponse.json(
      { error: "rate_limited", retryAfterMs: rl.resetMs },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(Math.ceil(rl.resetMs / 1000)));
    return { ok: false, res };
  }

  await audit({ businessId, userId, action });
  return { ok: true, session, businessId, userId };
}
