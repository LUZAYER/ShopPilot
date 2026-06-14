import { requireBusiness } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";
import Link from "next/link";
import { Inbox as InboxIcon, MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default async function InboxPage() {
  const { businessId } = await requireBusiness();
  const conversations = await db.conversation.findMany({
    where: { businessId },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Unified Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Messenger · WhatsApp · Facebook সব এক জায়গায়
        </p>
      </div>

      <Card>
        <div className="divide-y">
          {conversations.length === 0 && (
              <div className="p-6">
                <EmptyState
                  icon={<InboxIcon className="h-5 w-5" />}
                  title="No conversations yet"
                  body="Customer messages from Messenger, WhatsApp, and Facebook will land here."
                />
              </div>
            )}
          {conversations.map((c) => {
            const last = c.messages[0];
            return (
              <Link
                key={c.id}
                href={`/inbox/${c.id}`}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {c.customer.name?.[0]?.toUpperCase() || c.customer.phone?.[0] || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{c.customer.name || c.customer.phone}</p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {relativeTime(c.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {c.channel}
                    </Badge>
                    <p className="text-sm text-muted-foreground truncate">
                      {last?.content || "No messages"}
                    </p>
                  </div>
                </div>
                {c.unreadCount > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {c.unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
