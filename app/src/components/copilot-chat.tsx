"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Bot, User, Send, Sparkles, Loader2 } from "lucide-react";
import { askCopilot } from "@/lib/ai-client";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; citations?: { label: string; value: string }[] };

export function CopilotChat({ suggestions }: { suggestions: string[] }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "আসসালামু আলাইকুম! আমি ShopPilot Copilot। আপনার ব্যবসার ডেটা নিয়ে যেকোন প্রশ্ন করুন — যেমন বিক্রি, স্টক, গ্রাহক, ক্যাম্পেইন।"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function ask(q: string) {
    if (!q.trim()) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    const res = await askCopilot(q);
    setMessages((m) => [...m, { role: "assistant", content: res.answer, citations: res.citations }]);
    setLoading(false);
  }

  return (
    <Card className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}
            <div className={cn("max-w-[75%]", m.role === "user" ? "order-1" : "")}>
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm shadow-sm",
                  m.role === "user"
                    ? "bg-green-600 text-white rounded-br-sm"
                    : "bg-white text-gray-900 rounded-bl-sm border"
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {m.citations.map((c, j) => (
                    <div key={j} className="text-xs bg-white border rounded-md px-2.5 py-1.5 flex justify-between">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-medium">{c.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {m.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="p-3 border-t bg-white">
          <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => ask(s)}
                className="text-xs px-2.5 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t p-3 bg-white flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          placeholder="Ask anything about your business… / আপনার ব্যবসা সম্পর্কে জিজ্ঞেস করুন"
          rows={1}
          className="resize-none min-h-[42px]"
        />
        <Button onClick={() => ask(input)} disabled={!input.trim() || loading}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
