import { requireBusiness } from "@/lib/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBDT, relativeTime } from "@/lib/utils";
import { notFound } from "next/navigation";
import { Send, Sparkles, ShoppingCart, Bot } from "lucide-react";
import { ConversationThread } from "@/components/conversation-thread";
import { ReplyComposer } from "@/components/reply-composer";

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const { businessId } = await requireBusiness();
  const conversation = await db.conversation.findFirst({
    where: { id: params.id, businessId },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!conversation) notFound();

  const orderCount = await db.order.count({ where: { customerId: conversation.customerId } });

  await db.conversation.update({
    where: { id: conversation.id },
    data: { unreadCount: 0 }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-7rem)]">
      {/* Thread */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-semibold">
              {conversation.customer.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-semibold">{conversation.customer.name || conversation.customer.phone}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{conversation.channel}</Badge>
                <span>·</span>
                <span>{conversation.customer.phone}</span>
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline">
            <ShoppingCart className="h-4 w-4" /> Create order
          </Button>
        </div>

        <ConversationThread messages={conversation.messages} />
        <ReplyComposer conversationId={conversation.id} />
      </Card>

      {/* Customer + AI panel */}
      <div className="space-y-4 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Name" value={conversation.customer.name || "—"} />
            <Row label="Phone" value={conversation.customer.phone || "—"} />
            <Row label="City" value={conversation.customer.city || "—"} />
            <Row label="Total spent" value={formatBDT(conversation.customer.totalSpent)} />
            <Row label="Orders" value={orderCount.toString()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-green-600" /> AI assist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Sparkles className="h-3.5 w-3.5" /> Suggest replies
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Sparkles className="h-3.5 w-3.5" /> Translate to Bangla
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Sparkles className="h-3.5 w-3.5" /> Extract order from chat
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Sparkles className="h-3.5 w-3.5" /> Summarize thread
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium truncate max-w-[60%]">{value}</span>
    </div>
  );
}
