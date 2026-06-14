import { NextRequest, NextResponse } from "next/server";
import { generateCampaign, logAIUsage } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { protectRoute, Schemas } from "@/lib/security";

export async function POST(req: NextRequest) {
  const g = await protectRoute(req, "ai.campaign", Schemas.campaign);
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;

  // client sends {goal, budget, audience}; helper expects {name, goal, duration, budget}
  const r = await generateCampaign({
    name: `${cleaned.goal} – ${cleaned.audience}`,
    goal: cleaned.goal,
    duration: "2 weeks",
    budget: String(cleaned.budget)
  });
  await logAIUsage({ businessId, userId, feature: "campaign", result: r });

  await prisma.contentPost.create({
    data: {
      businessId,
      type: "campaign",
      title: cleaned.goal.slice(0, 100),
      prompt: `${cleaned.goal} | ${cleaned.audience} | ৳${cleaned.budget}`,
      output: r.content,
      body: r.content
    }
  });

  return NextResponse.json({ content: r.content, model: r.model, provider: r.provider });
}
