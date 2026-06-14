/**
 * Skeleton — shadcn-style placeholder used by route segment loading.tsx files.
 * Phase 12 UX primitive.
 */
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/70", className)}
      {...props}
    />
  );
}
