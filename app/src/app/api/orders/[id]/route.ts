import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { protectRoute, requireAuth, Schemas, audit } from "@/lib/security";
import { dispatchToCourier } from "@/lib/integrations";
import { emit } from "@/lib/automation";
import { safeAsync } from "@/lib/reliability";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const g = await requireAuth(req, "order.read_one", { rlMax: 120 });
  if (!g.ok) return g.res;
  const { businessId } = g;

  const order = await prisma.order.findFirst({
    where: { id: params.id, businessId },
    include: {
      customer: true,
      items: { include: { product: true } },
      payment: true,
      shipment: true,
      reseller: true,
      assignee: true
    }
  });
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const g = await protectRoute(req, "order.update", Schemas.orderUpdate, { rlMax: 60 });
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;

  const order = await prisma.order.findFirst({
    where: { id: params.id, businessId }
  });
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: any = {};
  if (cleaned.status) data.status = cleaned.status;
  if (cleaned.paymentStatus) {
    data.paymentStatus = cleaned.paymentStatus;
    if (cleaned.paymentStatus === "paid") data.paidAt = new Date();
  }
  if (cleaned.fulfillmentStatus) data.fulfillmentStatus = cleaned.fulfillmentStatus;
  if (cleaned.notes !== undefined) data.notes = cleaned.notes;
  if (cleaned.trackingCode) data.trackingCode = cleaned.trackingCode;

  const updated = await prisma.order.update({ where: { id: order.id }, data });

  // Side-effect: if the order is now paid, record a Payment row (idempotent)
  if (cleaned.paymentStatus === "paid") {
    const existing = await prisma.payment.findFirst({
      where: { orderId: order.id, status: "success" }
    });
    if (!existing) {
      await prisma.payment.create({
        data: {
          businessId: order.businessId,
          orderId: order.id,
          amount: order.total,
          method: order.paymentMethod,
          status: "success",
          trxId: "MANUAL-" + Date.now()
        }
      });
      safeAsync(
        () =>
          emit({
            type: "order.paid",
            businessId: order.businessId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            method: order.paymentMethod ?? "unknown",
            amount: order.total
          }),
        "emit:order.paid"
      );
    }
  }

  // Fire automation event for status changes
  if (cleaned.status === "shipped" || cleaned.fulfillmentStatus === "handed_to_courier") {
    safeAsync(
      () =>
        emit({
          type: "order.shipped",
          businessId: order.businessId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          courier: (cleaned.courier ?? "pathao") as string,
          tracking: (cleaned.trackingCode ?? null) as string | null
        }),
      "emit:order.shipped"
    );
  }
  if (cleaned.status === "cancelled") {
    safeAsync(
      () =>
        emit({
          type: "order.cancelled",
          businessId: order.businessId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: order.total
        }),
      "emit:order.cancelled"
    );
  }

  await audit({
    businessId,
    userId,
    action: "order.update",
    meta: {
      orderId: order.id,
      changed: Object.keys(data),
      status: cleaned.status ?? null,
      paymentStatus: cleaned.paymentStatus ?? null
    }
  });

  // Optional dispatch through courier integration
  if (
    cleaned.dispatch &&
    (cleaned.status === "shipped" || cleaned.fulfillmentStatus === "handed_to_courier")
  ) {
    try {
      const courier = (cleaned.courier ?? "pathao") as "pathao" | "steadfast" | "redx";
      const result = await dispatchToCourier({
        orderId: order.id,
        courier
      });
      return NextResponse.json({
        ...updated,
        dispatch: {
          ok: true,
          tracking: result?.trackingCode,
          consignmentId: result?.consignmentId
        }
      });
    } catch (e: any) {
      return NextResponse.json({
        ...updated,
        dispatch: { ok: false, error: e?.message ?? "dispatch_failed" }
      });
    }
  }

  return NextResponse.json(updated);
}
