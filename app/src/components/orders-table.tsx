"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatBDT, relativeTime } from "@/lib/utils";
import { Eye } from "lucide-react";

type Order = {
  id: string;
  short: string;
  customer: string;
  city: string;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  channel: string;
  createdAt: string;
  itemCount: number;
  summary: string;
};

const filters = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" }
];

export function OrdersTable({
  orders,
  statusMap,
  activeStatus
}: {
  orders: Order[];
  statusMap: Record<string, { label: string; variant: any }>;
  activeStatus: string;
}) {
  const router = useRouter();
  return (
    <div>
      <div className="flex gap-1 p-3 border-b overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => router.push(f.value === "all" ? "/orders" : `/orders?status=${f.value}`)}
            className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap ${
              activeStatus === f.value
                ? "bg-green-50 text-green-700 font-medium"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left p-3">Order</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Items</th>
              <th className="text-right p-3">Total</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Payment</th>
              <th className="text-left p-3">Date</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => {
              const s = statusMap[o.status] || { label: o.status, variant: "outline" as const };
              return (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{o.short}</td>
                  <td className="p-3">
                    <p className="font-medium">{o.customer}</p>
                    <p className="text-xs text-muted-foreground">{o.city}</p>
                  </td>
                  <td className="p-3 max-w-xs">
                    <p className="truncate text-xs text-muted-foreground">{o.summary}</p>
                    <p className="text-xs">{o.itemCount} item(s) · {o.channel}</p>
                  </td>
                  <td className="p-3 text-right font-semibold">{formatBDT(o.total)}</td>
                  <td className="p-3">
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={o.paymentStatus === "PAID" ? "success" : "outline"} className="text-[10px]">
                      {o.paymentStatus}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{o.paymentMethod}</p>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                    {relativeTime(new Date(o.createdAt))}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/orders/${o.id}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-gray-100"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted-foreground">
                  No orders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
