/**
 * Sentry client shim — only loads the real Sentry SDK when
 * NEXT_PUBLIC_SENTRY_DSN is set. In dev / preview the shim is a
 * console-only stub so we don't pay for or require a Sentry account.
 *
 * Activation rule: presence of NEXT_PUBLIC_SENTRY_DSN.
 *
 * If you want to wire the real SDK later, replace the stub with
 * `Sentry.init({ dsn, tracesSampleRate: 0.1 })` from `@sentry/nextjs`.
 */
export {};

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  // Real Sentry init goes here. We intentionally do not bundle the SDK
  // by default to keep the cold-start small.
  // eslint-disable-next-line no-console
  console.info("[sentry] would init with", {
    dsn: "***",
    environment: process.env.NODE_ENV
  });
}
