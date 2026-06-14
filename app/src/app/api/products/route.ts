import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { protectRoute, requireAuth, Schemas, audit } from "@/lib/security";
import { emit, checkLowStock } from "@/lib/automation";
import { safeAsync } from "@/lib/reliability";

export async function GET(req: NextRequest) {
  const g = await requireAuth(req, "product.read", { rlMax: 120 });
  if (!g.ok) return g.res;
  const { businessId } = g;
  const products = await prisma.product.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const g = await protectRoute(req, "product.create", Schemas.product, { rlMax: 60 });
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;

  const cost = (cleaned.cost ?? cleaned.costPrice ?? 0) as number;
  const stock = cleaned.stock as number;
  const lowStockAt = (cleaned.lowStockAt ?? 5) as number;

  const p = await prisma.product.create({
    data: {
      businessId,
      name: cleaned.name,
      category: cleaned.category ?? null,
      price: cleaned.price,
      cost,
      costPrice: cost,
      stock,
      lowStockAt,
      sku: cleaned.sku ?? null,
      description: cleaned.description ?? null,
      active: cleaned.active !== false,
      status: cleaned.status ?? "active"
    }
  });

  if (stock > 0) {
    await prisma.stockMovement.create({
      data: {
        productId: p.id,
        type: "IN",
        quantity: stock,
        reason: "INITIAL",
        reference: "manual"
      }
    });
  }

  await audit({
    businessId,
    userId,
    action: "product.create",
    meta: { productId: p.id, name: p.name, price: p.price, stock }
  });

  // Fire automation events (Phase 8)
  safeAsync(
    () =>
      emit({
        type: "product.created",
        businessId,
        productId: p.id,
        name: p.name,
        stock
      }),
    "emit:product.created"
  );
  if (stock <= lowStockAt) {
    safeAsync(
      () =>
        checkLowStock({
          businessId,
          productId: p.id,
          name: p.name,
          stock,
          lowStockAt
        }),
      "checkLowStock"
    );
  }

  return NextResponse.json(p);
}
