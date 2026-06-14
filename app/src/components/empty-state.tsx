/**
 * Reusable empty-state component — Phase 12 UX.
 *
 * Use for: empty product list, empty orders, no insights, no resellers.
 */
import { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, body, action, className }: Props) {
  return (
    <div className={cn(
      "rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center",
      className
    )}>
      <div className="mx-auto h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {body ? <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
