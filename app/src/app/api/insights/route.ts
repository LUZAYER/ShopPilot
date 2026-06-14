import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { protectRoute, requireAuth, Schemas, audit } from "@/lib/security";
import { generateInsights } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const g = await requireAuth(req, "insights.read", { rlMax: 60 });
  if (!g.ok) return g.res;
  const { businessId } = g;
  const insights = await prisma.insight.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return NextResponse.json(insights);
}

export async function POST(req: NextRequest) {
  const g = await protectRoute(
    req,
    "insights.generate",
    Schemas.insightsGenerate ?? Schemas.message /* fallback if optional() */,
    { rlMax: 10 }
  );
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;
  void cleaned; // body is optional

  const insights = await generateInsights(businessId);
  const created: any[] = [];
  for (const i of insights) {
    const row = await prisma.insight.create({
      data: {
        businessId,
        type: i.type,
        title: i.title,
        body: i.body,
        priority: i.severity ?? i.priority ?? "medium",
        severity: i.severity ?? i.priority ?? "medium",
        data: JSON.stringify(i.data ?? {})
      }
    });
    created.push(row);
  }

  await audit({
    businessId,
    userId,
    action: "insights.generate",
    meta: { generated: created.length }
  });

  return NextResponse.json({ created: created.length, insights: created });
}
