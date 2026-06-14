import { NextRequest, NextResponse } from "next/server";
import { suggestReplies, logAIUsage } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { protectRoute, Schemas, audit } from "@/lib/security";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await protectRoute(req, "ai.suggest_replies", Schemas.suggestReplies, { rlMax: 20 });
  if (!g.ok) return g.res;
  const { businessId, userId } = g;

  const conv = await prisma.conversation.findFirst({
    where: { id: params.id, businessId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 6 } }
  });
  if (!conv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // If the client sent a fresh message, prefer it; otherwise use the last
  // inbound message from the conversation.
  const lastInbound =
    g.cleaned.message ||
    conv.messages.find((m) => m.direction === "inbound")?.content ||
    "";

  if (!lastInbound) {
    return NextResponse.json({ suggestions: [], intent: "no_input" });
  }

  const r = await suggestReplies(lastInbound);
  await logAIUsage({ businessId, userId, feature: "suggest_replies", result: r });

  let parsed: any = { replies: [], intent: "unknown", sentiment: "neutral" };
  try { parsed = JSON.parse(r.content); } catch {}

  await audit({
    businessId,
    userId,
    action: "ai.suggest_replies",
    meta: { conversationId: conv.id, suggestions: (parsed.replies || []).length }
  });

  return NextResponse.json({
    suggestions: parsed.replies || [],
    intent: parsed.intent,
    sentiment: parsed.sentiment,
    urgency: parsed.urgency,
    actions: parsed.actions,
    confidence: parsed.confidence
  });
}
