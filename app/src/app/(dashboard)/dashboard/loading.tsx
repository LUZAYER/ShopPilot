/**
 * Route segment loading UI — Phase 12 UX.
 * Renders during server-side data fetches for the dashboard.
 */
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center p-12 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      <div className="grid grid-cols-4 gap-4 w-full max-w-4xl mt-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64 w-full max-w-4xl" />
    </div>
  );
}
