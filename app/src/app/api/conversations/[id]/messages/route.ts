import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { protectRoute, Schemas, audit } from "@/lib/security";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await protectRoute(req, "message.send", Schemas.message);
  if (!g.ok) return g.res;
  const { businessId, userId, cleaned } = g;

  const conv = await prisma.conversation.findFirst({
    where: { id: params.id, businessId }
  });
  if (!conv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const text = (cleaned.content || cleaned.body || "").trim();
  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      direction: "outbound",
      senderId: userId,
      senderType: "agent",
      content: text
    }
  });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: new Date(), updatedAt: new Date(), unreadCount: 0 }
  });

  await audit({
    businessId,
    userId,
    action: "message.send",
    meta: { conversationId: conv.id, length: text.length }
  });

  return NextResponse.json(msg);
}
