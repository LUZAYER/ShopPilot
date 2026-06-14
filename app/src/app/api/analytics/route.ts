import { NextRequest, NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/analytics";
import { requireAuth } from "@/lib/security";

export async function GET(req: NextRequest) {
  const g = await requireAuth(req, "analytics.read", { rlMax: 60 });
  if (!g.ok) return g.res;
  const { businessId } = g;
  const snap = await buildSnapshot({ businessId });
  return NextResponse.json(snap);
}
