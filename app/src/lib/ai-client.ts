// Client-safe helpers for AI feature calls (only POST + JSON).

export async function generateProductDescription(input: {
  name: string;
  category?: string;
  features?: string;
  tone?: string;
}) {
  const r = await fetch("/api/ai/product-description", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return r.json() as Promise<{ title: string; body: string; bullets: string[] }>;
}

export async function generateFacebookPost(input: {
  productId?: string;
  topic: string;
  tone?: string;
}) {
  const r = await fetch("/api/ai/facebook-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return r.json() as Promise<{ headline: string; body: string; hashtags: string[] }>;
}

export async function generateCampaign(input: {
  goal: string;
  budget: number;
  audience: string;
}) {
  const r = await fetch("/api/ai/campaign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return r.json() as Promise<{ strategy: string; channels: string[]; steps: string[] }>;
}

export async function translateText(text: string, target: "en" | "bn") {
  const r = await fetch("/api/ai/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target })
  });
  return r.json() as Promise<{ translated: string }>;
}

export async function askCopilot(question: string) {
  const r = await fetch("/api/copilot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });
  return r.json() as Promise<{ answer: string; citations?: { label: string; value: string }[] }>;
}

export async function suggestReplies(conversationId: string) {
  const r = await fetch(`/api/conversations/${conversationId}/suggest`, { method: "POST" });
  return r.json() as Promise<{ suggestions: string[] }>;
}
