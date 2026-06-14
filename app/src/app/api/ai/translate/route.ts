import { NextRequest, NextResponse } from "next/server";
import { translateText, logAIUsage } from "@/lib/ai";
import { protectRoute, Schemas } from "@/lib/security";

export async function POST(req: NextRequest) {
  const g = await protectRoute(req, "ai.translate", Schemas.translate);
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;

  // client sends {text, target}; helper expects {text, from, to}
  const from = cleaned.target === "bn" ? "en" : "bn";
  const r = await translateText({ text: cleaned.text, from, to: cleaned.target });
  await logAIUsage({ businessId, userId, feature: "translate", result: r });
  return NextResponse.json({ content: r.content, model: r.model, provider: r.provider });
}
