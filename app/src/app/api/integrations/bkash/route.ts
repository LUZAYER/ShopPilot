import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { protectRoute, Schemas, audit } from "@/lib/security";
import { bkashCreateCharge, bkashVerify } from "@/lib/integrations";
import { emit } from "@/lib/automation";
import { safeAsync } from "@/lib/reliability";

export async function POST(req: NextRequest) {
  const g = await protectRoute(
    req,
    // Re-use a synthetic action name; we audit the actual bkash action below.
    "order.update",
    Schemas.bkash,
    { rlMax: 30 }
  );
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;

  if (cleaned.action === "verify") {
    const verify = await bkashVerify(cleaned.paymentId!);
    const status = (verify as any)?.status ?? "Unknown";
    const trxID = (verify as any)?.trxID ?? cleaned.paymentId ?? null;

    if (status === "Completed" && cleaned.orderId) {
      const order = await prisma.order.findFirst({
        where: { id: cleaned.orderId, businessId }
      });
      if (!order) {
        return NextResponse.json(
          { error: "order_not_found" },
          { status: 404 }
        );
      }
      // Idempotent: skip if a successful payment already exists
      const existing = await prisma.payment.findFirst({
        where: { orderId: order.id, status: "success" }
      });
      if (!existing) {
        await prisma.payment.create({
          data: {
            businessId,
            orderId: order.id,
            amount: cleaned.amount ?? order.total,
            method: "bKash",
            status: "success",
            trxId: trxID ?? "UNKNOWN"
          }
        });
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "paid", paidAt: new Date() }
        });
      }
    }

    await audit({
      businessId,
      userId,
      action: "order.update",
      meta: {
        integration: "bkash",
        action: "verify",
        status,
        trxId: trxID
      }
    });

    return NextResponse.json(verify);
  }

  // cleaned.action === "create"
  const charge = await bkashCreateCharge({
    amount: cleaned.amount!,
    invoiceNumber: cleaned.invoiceNumber ?? `INV-${Date.now()}`,
    customerPhone: cleaned.customerPhone ?? "01000000000"
  });

  await audit({
    businessId,
    userId,
    action: "order.update",
    meta: {
      integration: "bkash",
      action: "create",
      amount: cleaned.amount,
      invoice: cleaned.invoiceNumber ?? null
    }
  });

  // Fire automation event for failed charges
  const status = (charge as any)?.status ?? (charge as any)?.transactionStatus;
  if (status && status !== "Completed" && status !== "Success" && status !== "Initiated") {
    safeAsync(
      () =>
        emit({
          type: "payment.failed",
          businessId,
          orderId: cleaned.orderId ?? "",
          method: "bKash",
          reason: String(status)
        }),
      "emit:payment.failed"
    );
  }

  return NextResponse.json(charge);
}
