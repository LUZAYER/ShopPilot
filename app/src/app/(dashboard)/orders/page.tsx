import { requireBusiness } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBDT, shortId } from "@/lib/utils";
import { OrdersTable } from "@/components/orders-table";
import { EmptyState } from "@/components/empty-state";
import { ShoppingBag } from "lucide-react";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }> = {
  new: { label: "New", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "default" },
  packed: { label: "Packed", variant: "secondary" },
  shipped: { label: "Shipped", variant: "default" },
  delivered: { label: "Delivered", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  returned: { label: "Returned", variant: "outline" }
};

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const { businessId } = await requireBusiness();
  const orders = await db.order.findMany({
    where: {
      businessId,
      ...(searchParams.status && searchParams.status !== "all" ? { status: searchParams.status as any } : {})
    },
    include: { customer: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-muted-foreground">অর্ডার ব্যবস্থাপনা ও ট্র্যাকিং</p>
        </div>
        <Badge variant="outline">{orders.length} total</Badge>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="No orders yet"
          body="When customers place orders through chat or your storefront, they'll appear here."
        />
      ) : (
        <Card>
          <OrdersTable
            orders={orders.map((o) => ({
              id: o.id,
              short: shortId(o.id),
              customer: o.customer.name || o.customer.phone || "—",
              city: o.customer.city || "—",
              total: o.total,
              status: o.status,
              paymentStatus: o.paymentStatus,
              paymentMethod: o.paymentMethod,
              channel: o.channel ?? o.source ?? "—",
              createdAt: o.createdAt.toISOString(),
              itemCount: o.items.length,
              summary: o.items.map((i) => i.product.name).join(", ")
            }))}
            statusMap={statusMap}
            activeStatus={searchParams.status || "all"}
          />
        </Card>
      )}
    </div>
  );
}
