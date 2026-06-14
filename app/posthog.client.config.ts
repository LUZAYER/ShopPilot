/**
 * PostHog client shim — only loads posthog-js when
 * NEXT_PUBLIC_POSTHOG_KEY is set. Without it, calls are no-ops and
 * the analytics queue is just a console log.
 *
 * Real PostHog init would go here:
 *   posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
 *     api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com"
 *   });
 */
export {};

if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY
) {
  // eslint-disable-next-line no-console
  console.info("[posthog] would init with", {
    key: "***",
    host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com"
  });
}
