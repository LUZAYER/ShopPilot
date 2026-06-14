/**
 * Route segment loading UI — Phase 12 UX.
 */
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center p-12 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Loading copilot…</p>
      <Skeleton className="h-96 w-full max-w-3xl" />
    </div>
  );
}
