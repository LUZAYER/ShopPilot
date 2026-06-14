/**
 * Route segment loading UI — Phase 12 UX.
 */
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center p-12 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Loading content studio…</p>
      <Skeleton className="h-12 w-full max-w-4xl" />
      <Skeleton className="h-64 w-full max-w-4xl" />
    </div>
  );
}
