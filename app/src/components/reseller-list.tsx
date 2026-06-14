"use client";

import { Badge } from "@/components/ui/badge";
import { formatBDT, relativeTime } from "@/lib/utils";
import { Mail, Phone, MapPin } from "lucide-react";

type Reseller = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  status: string;
  tier: string;
  rate: number;
  sales: number;
  orders: number;
  commission: number;
  joinedAt: string;
};

export function ResellerList({ resellers }: { resellers: Reseller[] }) {
  if (resellers.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No resellers yet — invite your first partner</p>;
  }
  return (
    <div className="divide-y">
      {resellers.map((r) => (
        <div key={r.id} className="flex items-center gap-4 py-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-semibold shrink-0">
            {r.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium">{r.name}</p>
              <Badge variant={r.status === "ACTIVE" ? "success" : "outline"} className="text-[10px]">
                {r.status}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">{r.tier}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>
              {r.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
              {r.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.city}</span>}
            </div>
          </div>
          <div className="text-right text-sm shrink-0">
            <p className="font-semibold">{formatBDT(r.sales)}</p>
            <p className="text-xs text-muted-foreground">{r.orders} orders · {r.rate}% rate</p>
            <p className="text-xs text-green-600 font-medium">+{formatBDT(r.commission)} earned</p>
          </div>
        </div>
      ))}
    </div>
  );
}
