import { NextRequest, NextResponse } from "next/server";
import { copilotAnswer, logAIUsage } from "@/lib/ai";
import { buildSnapshot } from "@/lib/analytics";
import { protectRoute, Schemas } from "@/lib/security";

export async function POST(req: NextRequest) {
  const g = await protectRoute(req, "ai.copilot", Schemas.copilot, { rlMax: 20 });
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;

  const snap = await buildSnapshot({ businessId });
  const r = await copilotAnswer(cleaned.question, {
    businessName: snap.businessName,
    metrics: snap
  });
  await logAIUsage({ businessId, userId, feature: "copilot", result: r });

  return NextResponse.json({
    answer: r.content,
    model: r.model,
    provider: r.provider,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut
  });
}
