import { NextRequest, NextResponse } from "next/server";
import { generateFacebookPost, logAIUsage } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { protectRoute, Schemas } from "@/lib/security";

export async function POST(req: NextRequest) {
  const g = await protectRoute(req, "ai.facebook_post", Schemas.facebookPost);
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;

  // client sends {topic, tone?}; helper expects {product, audience?, offer?}
  const r = await generateFacebookPost({
    product: cleaned.topic,
    audience: cleaned.tone,
    offer: undefined
  });
  await logAIUsage({ businessId, userId, feature: "facebook_post", result: r });

  await prisma.contentPost.create({
    data: {
      businessId,
      type: "facebook_post",
      channel: "facebook",
      platform: "facebook",
      title: cleaned.topic.slice(0, 100),
      prompt: cleaned.topic,
      output: r.content,
      body: r.content
    }
  });

  return NextResponse.json({ content: r.content, model: r.model, provider: r.provider });
}
