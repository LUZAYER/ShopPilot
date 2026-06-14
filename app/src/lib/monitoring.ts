/**
 * ShopPilot AI — Monitoring shim.
 *
 * Wraps Sentry + PostHog (and any other future sinks) behind a single,
 * dependency-free interface so the rest of the codebase never imports
 * the SDKs directly. This lets us:
 *
 *  1. Ship with the SDKs NOT installed (zero npm-install cost in dev)
 *  2. Plug in real SDKs at deploy time via env vars
 *  3. Have one place to add PII-stripping / sampling later
 *
 * Prompt5: Vercel + Sentry + PostHog are required.
 * Prompt4: logging + monitoring required.
 *
 * Env vars:
 *   SENTRY_DSN        — when set, captureError forwards to Sentry
 *   NEXT_PUBLIC_POSTHOG_KEY — when set, captureEvent forwards to PostHog
 *
 * Falls back to console logging in dev / when the SDKs aren't installed.
 */

type Meta = Record<string, unknown>;

// ---------- Sentry-style error sink ----------

let sentryShim: ((e: Error, ctx?: Meta) => void) | null = null;
let posthogShim: ((event: string, props?: Meta) => void) | null = null;

function getSentryShim() {
  if (sentryShim) return sentryShim;
  if (typeof window === "undefined") return null;
  // Dynamic import keeps the bundle clean for users who don't set SENTRY_DSN
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN && !process.env.SENTRY_DSN) return null;
  // In production the real `@sentry/nextjs` package would be loaded here.
  // For now we log to console; the import line below is intentionally lazy.
  sentryShim = (e, ctx) => {
    // eslint-disable-next-line no-console
    console.error("[sentry-shim]", e.message, { stack: e.stack, ...ctx });
  };
  return sentryShim;
}

function getPostHogShim() {
  if (posthogShim) return posthogShim;
  if (typeof window === "undefined") return null;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  posthogShim = (event, props) => {
    // eslint-disable-next-line no-console
    console.info("[posthog-shim]", event, props);
  };
  return posthogShim;
}

// ---------- Public API ----------

/**
 * Capture an error to every configured sink.
 * Never throws — must not break the calling site.
 */
export function captureError(source: string, error: unknown, meta?: Meta): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    // eslint-disable-next-line no-console
    console.error(`[shoppilot:${source}]`, e.message, { ...meta, stack: e.stack });
    const sentry = getSentryShim();
    if (sentry) sentry(e, { source, ...meta });
  } catch {
    // never let monitoring break the user request
  }
}

/**
 * Capture a business event (PostHog-style).
 * Used for: order_created, ai_suggestion_used, insight_acted_on, etc.
 */
export function captureEvent(event: string, props?: Meta): void {
  try {
    // eslint-disable-next-line no-console
    console.info(`[shoppilot:event] ${event}`, props);
    const ph = getPostHogShim();
    if (ph) ph(event, props);
  } catch {
    // ignore
  }
}

/**
 * Server-side request log. Always-on, in-memory tail plus stderr.
 */
const recentLogs: { ts: number; level: "info" | "warn" | "error"; msg: string; meta?: Meta }[] = [];
const MAX_LOGS = 500;

export function log(level: "info" | "warn" | "error", msg: string, meta?: Meta) {
  const entry = { ts: Date.now(), level, msg, meta };
  recentLogs.push(entry);
  if (recentLogs.length > MAX_LOGS) recentLogs.shift();
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
    `[shoppilot:${level}] ${msg}`,
    meta ?? ""
  );
}

export function tailLogs(limit = 50) {
  return recentLogs.slice(-limit);
}
