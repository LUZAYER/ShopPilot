"use client";

/**
 * Global error boundary — Next.js App Router.
 *
 * Triggered when:
 *  - A server component throws during render
 *  - A client component throws during render
 *
 * It does NOT trigger on runtime errors inside event handlers or async code —
 * those are caught by `lib/reliability` (withRetry) and by route-level try/catch.
 *
 * Phase 12: Error boundary required by prompt3 and prompt4 (UX Review).
 */
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { captureError } from "@/lib/monitoring";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError("app_error_boundary", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertTriangle className="h-7 w-7 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-slate-600 mb-6">
          We hit an unexpected error while rendering this page. Our team has been notified.
        </p>
        {error.digest ? (
          <p className="text-xs text-slate-400 mb-4 font-mono">ref: {error.digest}</p>
        ) : null}
        <div className="flex gap-2 justify-center">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" /> Try again
          </Button>
          <Button onClick={() => (window.location.href = "/dashboard")} variant="outline">
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}