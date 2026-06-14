"use client";

/**
 * Client-side error boundary — wraps any subtree that may throw.
 *
 * Use it for sections that are independently fault-tolerant:
 *   <ErrorBoundary fallback={<EmptyState />}>
 *     <ExpensiveWidget />
 *   </ErrorBoundary>
 *
 * Phase 12: prompt3 + prompt4.
 */
import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
};
type State = { hasError: boolean; error?: Error };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Lazy import to keep this component light
    import("@/lib/monitoring").then((m) => m.captureError("client_error_boundary", error));
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{this.props.label ?? "This section"} failed to load.</p>
            <p className="text-xs text-red-600 mt-0.5">Try refreshing the page.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
