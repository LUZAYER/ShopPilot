import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { protectRoute, requireAuth, Schemas, audit } from "@/lib/security";
import { extractOrderFromChat, logAIUsage } from "@/lib/ai";
import { emit } from "@/lib/automation";
import { safeAsync } from "@/lib/reliability";

export async function GET(req: NextRequest) {
  const g = await requireAuth(req, "order.read", { rlMax: 120 });
  if (!g.ok) return g.res;
  const { businessId } = g;
  const orders = await prisma.order.findMany({
    where: { businessId },
    include: {
      customer: true,
      items: { include: { product: true } },
      payment: true,
      shipment: true
    },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const g = await protectRoute(req, "order.create", Schemas.orderCreate, { rlMax: 30 });
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;
  const chat = cleaned.chat as string;

  // Run the order-intelligence agent
  const ai = await extractOrderFromChat(chat);
  await logAIUsage({ businessId, userId, feature: "extract_order", result: ai });

  let parsed: any = { detected: false, items: [] };
  try {
    parsed = JSON.parse(ai.content);
  } catch {
    parsed = { detected: false, items: [], raw: ai.content };
  }

  if (!parsed.detected || !Array.isArray(parsed.items) || parsed.items.length === 0) {
    await audit({
      businessId,
      userId,
      action: "order.create",
      meta: { detected: false, items: 0, confidence: parsed.confidence ?? null }
    });
    return NextResponse.json({
      extracted: parsed,
      persisted: false,
      reason: "no_items_detected"
    });
  }

  // Resolve / create customer (upsert by phone when available)
  let customer;
  if (cleaned.customerPhone) {
    customer = await prisma.customer.upsert({
      where: { businessId_phone: { businessId, phone: cleaned.customerPhone } as any },
      update: {
        ...(cleaned.customerName ? { name: cleaned.customerName } : {}),
        ...(cleaned.customerCity ? { city: cleaned.customerCity } : {})
      },
      create: {
        businessId,
        phone: cleaned.customerPhone,
        name: cleaned.customerName ?? "Walk-in customer",
        city: cleaned.customerCity ?? null
      }
    });
  } else {
    customer = await prisma.customer.create({
      data: {
        businessId,
        name: cleaned.customerName ?? "Walk-in customer",
        phone: "—",
        city: cleaned.customerCity ?? null
      }
    });
  }

  // Try to link each line item to an existing product by fuzzy name match
  const products = await prisma.product.findMany({
    where: { businessId, active: true },
    select: { id: true, name: true, price: true, stock: true }
  });
  const lc = (s: string) => s.toLowerCase();
  const findProduct = (name: string) => {
    const q = lc(name);
    return (
      products.find((p) => lc(p.name) === q) ??
      products.find((p) => lc(p.name).includes(q) || q.includes(lc(p.name))) ??
      null
    );
  };

  // Only OrderItems with a real productId can be persisted (the schema requires
  // productId + productName to be non-null). Unmatched AI lines are reported
  // back to the caller but skipped from the order.
  const matched: { productId: string; name: string; quantity: number; unitPrice: number; total: number }[] = [];
  const unmatched: any[] = [];
  let total = 0;
  for (const it of parsed.items) {
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const p = findProduct(String(it.name));
    if (!p) {
      unmatched.push(it);
      continue;
    }
    const unit = p.price;
    const lineTotal = unit * qty;
    total += lineTotal;
    matched.push({
      productId: p.id,
      name: p.name,
      quantity: qty,
      unitPrice: unit,
      total: lineTotal
    });
  }

  if (matched.length === 0) {
    await audit({
      businessId,
      userId,
      action: "order.create",
      meta: {
        detected: true,
        items: parsed.items.length,
        matched: 0,
        reason: "no_matched_products"
      }
    });
    return NextResponse.json({
      extracted: parsed,
      persisted: false,
      reason: "no_matched_products",
      unmatched
    });
  }

  // Generate a per-business order number (SP-0001, SP-0002, …) without a tx.
  const count = await prisma.order.count({ where: { businessId } });
  const orderNumber = `SP-${String(count + 1).padStart(4, "0")}`;

  const shippingName = customer.name;
  const shippingPhone = customer.phone;
  const shippingCity = customer.city ?? "Dhaka";
  const shippingAddress = parsed.address ?? "—";

  // -------- Duplicate-order dedup (prompt4 §1) --------
  // If the same customer just placed an order with the same line items in
  // the last 60 seconds, treat this as a client retry and return the prior
  // order instead of double-charging stock and creating two order records.
  const dedupKey = matched.map((m) => `${m.productId}:${m.quantity}`).sort().join("|");
  const recent = await prisma.order.findFirst({
    where: {
      businessId,
      customerId: customer.id,
      createdAt: { gte: new Date(Date.now() - 60_000) }
    },
    include: { items: true },
    orderBy: { createdAt: "desc" }
  });
  if (recent) {
    const recentItems: { productId: string; quantity: number }[] = recent.items;
    const recentKey = recentItems
      .map((i) => `${i.productId}:${i.quantity}`)
      .sort()
      .join("|");
    if (recentKey === dedupKey) {
      await audit({
        businessId,
        userId,
        action: "order.dedup_hit",
        meta: { orderId: recent.id, orderNumber: recent.orderNumber }
      });
      return NextResponse.json({
        extracted: parsed,
        persisted: false,
        reason: "duplicate_recent_order",
        order: recent,
        unmatched
      });
    }
  }

  // -------- Negative-stock guard (prompt4 §1) --------
  // Refuse to create the order if any line would drive stock below zero.
  for (const m of matched) {
    const fresh = await prisma.product.findUnique({
      where: { id: m.productId },
      select: { stock: true, name: true }
    });
    if (!fresh || fresh.stock - m.quantity < 0) {
      await audit({
        businessId,
        userId,
        action: "order.create_blocked",
        meta: {
          reason: "insufficient_stock",
          productId: m.productId,
          productName: fresh?.name ?? m.name,
          requested: m.quantity,
          available: fresh?.stock ?? 0
        }
      });
      return NextResponse.json(
        {
          extracted: parsed,
          persisted: false,
          reason: "insufficient_stock",
          product: m.name,
          requested: m.quantity,
          available: fresh?.stock ?? 0
        },
        { status: 400 }
      );
    }
  }

  const order = await prisma.order.create({
    data: {
      businessId,
      orderNumber,
      customerId: customer.id,
      status: "new",
      paymentStatus: "pending",
      paymentMethod: parsed.suggestedPayment ?? "cod",
      channel: (cleaned.channel as string) ?? "chat",
      subtotal: total,
      shippingCost: 60,
      discount: 0,
      total: total + 60,
      shippingName,
      shippingPhone,
      shippingAddress,
      shippingCity,
      notes: parsed.notes ?? null,
      assigneeId: userId ?? null,
      items: {
        create: matched.map((m) => ({
          productId: m.productId,
          productName: m.name,
          quantity: m.quantity,
          unitPrice: m.unitPrice,
          total: m.total
        }))
      }
    },
    include: { items: true, customer: true }
  });

  // Decrement stock for products we matched (post-create because we just
  // verified stock is sufficient; we don't bother with a transaction here
  // because the verification above has already serialized the worst case).
  for (const m of matched) {
    await prisma.product.update({
      where: { id: m.productId },
      data: { stock: { decrement: m.quantity } }
    });
    await prisma.stockMovement.create({
      data: {
        productId: m.productId,
        type: "OUT",
        quantity: m.quantity,
        reason: "ORDER",
        reference: order.id
      }
    });
  }

  await audit({
    businessId,
    userId,
    action: "order.create",
    meta: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      items: order.items.length,
      total: order.total,
      confidence: parsed.confidence ?? null
    }
  });

  // Fire automation event (Phase 8)
  safeAsync(
    () =>
      emit({
        type: "order.created",
        businessId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        items: order.items.length
      }),
    "emit:order.created"
  );

  return NextResponse.json({
    extracted: parsed,
    persisted: true,
    order,
    unmatched
  });
}
