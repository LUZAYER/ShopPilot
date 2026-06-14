"use client";

import { useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { suggestReplies } from "@/lib/ai-client";

export function ReplyComposer({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function onSuggest() {
    setLoading(true);
    const res = await fetch(`/api/conversations/${conversationId}/suggest`);
    const data = await res.json();
    setSuggestions(data.suggestions || []);
    setLoading(false);
  }

  async function onSend() {
    if (!text.trim()) return;
    await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text })
    });
    setText("");
  }

  return (
    <div className="border-t bg-white p-3 space-y-2">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setText(s)}
              className="text-xs px-2.5 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 text-left"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end">
        <Button
          size="icon"
          variant="outline"
          onClick={onSuggest}
          disabled={loading}
          title="Suggest replies"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your reply… / আপনার উত্তর লিখুন"
          rows={2}
          className="resize-none"
        />
        <Button onClick={onSend} disabled={!text.trim()}>
          <Send className="h-4 w-4" /> Send
        </Button>
      </div>
    </div>
  );
}
