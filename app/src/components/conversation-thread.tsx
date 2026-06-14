"use client";

import { cn, relativeTime } from "@/lib/utils";

type Msg = {
  id: string;
  direction: string;
  content: string;
  createdAt: Date;
  senderType: string;
};

export function ConversationThread({ messages }: { messages: Msg[] }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
      {messages.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-12">No messages yet</p>
      )}
      {messages.map((m) => {
        const isOut = m.direction === "outbound" || m.direction === "OUTBOUND";
        return (
          <div key={m.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                isOut
                  ? "bg-green-600 text-white rounded-br-sm"
                  : "bg-white text-gray-900 rounded-bl-sm border"
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              <p className={cn("text-[10px] mt-1", isOut ? "text-green-100" : "text-gray-400")}>
                {m.senderType} · {relativeTime(m.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
