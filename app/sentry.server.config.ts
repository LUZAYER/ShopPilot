/**
 * Sentry server shim — only logs the activation intent when
 * SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) is set.
 *
 * Real Sentry server init would go here.
 */
export {};

if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  // eslint-disable-next-line no-console
  console.info("[sentry:server] would init with", {
    environment: process.env.NODE_ENV
  });
}
