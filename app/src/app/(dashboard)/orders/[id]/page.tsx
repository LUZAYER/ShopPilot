import { requireBusiness } from "@/lib/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBDT, shortId } from "@/lib/utils";
import { OrderActions } from "@/components/order-actions";
import { notFound } from "next/navigation";
import { Package, MapPin, User, CreditCard, Truck } from "lucide-react";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const { businessId } = await requireBusiness();
  const order = await db.order.findFirst({
    where: { id: params.id, businessId },
    include: {
      customer: true,
      items: { include: { product: true } },
      payment: true,
      shipment: true
    }
  });
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Order {shortId(order.id)}
            <Badge>{order.status}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">{order.channel ?? order.source ?? "—"} · {order.createdAt.toLocaleString()}</p>
        </div>
        <OrderActions
          orderId={order.id}
          status={order.status}
          paymentStatus={order.paymentStatus}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="text-left py-2">Product</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y">
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2">{i.product.name}</td>
                    <td className="text-right">{i.quantity}</td>
                    <td className="text-right">{formatBDT(i.unitPrice)}</td>
                    <td className="text-right font-medium">{formatBDT(i.unitPrice * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="text-right py-2 font-medium">Subtotal</td>
                  <td className="text-right">{formatBDT(order.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="text-right text-muted-foreground">Shipping</td>
                  <td className="text-right">{formatBDT(order.shippingCost)}</td>
                </tr>
                <tr className="border-t">
                  <td colSpan={3} className="text-right py-3 font-bold">Total</td>
                  <td className="text-right py-3 font-bold text-lg">{formatBDT(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{order.customer.name || "—"}</p>
              <p className="text-muted-foreground">{order.customer.phone}</p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {order.customer.city || order.shippingCity || "—"}
              </p>
              {order.customer.address && (
                <p className="text-xs text-muted-foreground mt-1">{order.customer.address}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <Row label="Method" value={order.paymentMethod} />
              <Row label="Status" value={order.paymentStatus} />
              <Row label="Amount" value={formatBDT(order.total)} />
              {order.payment?.trxId && (
                <Row label="TrxID" value={order.payment.trxId} />
              )}
            </CardContent>
          </Card>

          {order.shipment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4" /> Shipment
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="font-medium">{order.shipment.courierName}</p>
                <p className="text-muted-foreground">{order.shipment.courierTracking}</p>
                <Badge variant="outline" className="mt-1 text-[10px]">{order.shipment.status}</Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
