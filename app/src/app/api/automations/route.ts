/**
 * GET /api/automations — list the last 50 automation-emitted insights/notifications
 * POST /api/automations/test — fire a test event (dev only; gated by NEXTAUTH_URL not localhost)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/security";
import { emit } from "@/lib/automation";

export async function GET(req: NextRequest) {
  const g = await requireAuth(req, "insights.read", { rlMax: 60 });
  if (!g.ok) return g.res;
  const { businessId } = g;
  const items = await prisma.insight.findMany({
    where: { businessId, type: { in: ["alert", "ops", "opportunity"] } },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return NextResponse.json({ count: items.length, notifications: items });
}

/**
 * Dev-only test fire. Refuses in non-localhost deployments.
 */
export async function POST(req: NextRequest) {
  const g = await requireAuth(req, "insights.generate", { rlMax: 10 });
  if (!g.ok) return g.res;
  const base = process.env.NEXTAUTH_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(base) && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled_in_prod" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { type?: string; orderId?: string };
  if (body.type === "order.created" && body.orderId) {
    const o = await prisma.order.findFirst({
      where: { id: body.orderId, businessId: g.businessId },
      select: { id: true, orderNumber: true, total: true, items: { select: { id: true } } }
    });
    if (!o) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const out = await emit({
      type: "order.created",
      businessId: g.businessId,
      orderId: o.id,
      orderNumber: o.orderNumber,
      total: o.total,
      items: o.items.length
    });
    return NextResponse.json({ fired: out.length, notifications: out });
  }
  return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
}
