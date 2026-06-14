import { NextRequest, NextResponse } from "next/server";
import { generateProductDescription, logAIUsage } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { protectRoute, Schemas } from "@/lib/security";

export async function POST(req: NextRequest) {
  const g = await protectRoute(req, "ai.product_description", Schemas.productDescription);
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;

  // client sends {name, category?, features?, tone?}; helper expects {name, category?, keyPoints?}
  const r = await generateProductDescription({
    name: cleaned.name,
    category: cleaned.category,
    keyPoints: cleaned.features
  });
  await logAIUsage({ businessId, userId, feature: "product_description", result: r });

  await prisma.contentPost.create({
    data: {
      businessId,
      type: "product_description",
      title: cleaned.name,
      prompt: cleaned.name,
      output: r.content,
      body: r.content
    }
  });

  return NextResponse.json({ content: r.content, model: r.model, provider: r.provider });
}
