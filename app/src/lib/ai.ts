// ShopPilot AI — Multi-provider AI layer with a deterministic mock fallback.
//
// To enable a real provider, set ONE of:
//   AI_PROVIDER=openai   + OPENAI_API_KEY=sk-...      (+ optional OPENAI_MODEL)
//   AI_PROVIDER=gemini   + GEMINI_API_KEY=...         (+ optional GEMINI_MODEL)
//
// If a real provider is selected but its API key is missing, or if the call
// fails (network, rate limit, timeout), we fall back to the mock so the demo
// keeps working. The mock also runs when AI_PROVIDER is unset / "mock".
import { prisma } from "./db";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type AIProvider = "openai" | "gemini" | "mock";

function provider(): AIProvider {
  const raw = (process.env.AI_PROVIDER ?? "").toLowerCase();
  if (raw === "openai" || raw === "gemini") return raw;
  return "mock";
}

// 25-second hard cap so a slow OpenAI call can never block an HTTP route.
const FETCH_TIMEOUT_MS = Number(process.env.AI_FETCH_TIMEOUT_MS ?? 25_000);

function withTimeout(ms: number) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`AI fetch timed out after ${ms}ms`)), ms)
  );
}

export async function chat(messages: ChatMessage[], opts?: { temperature?: number; json?: boolean }) {
  const p = provider();

  // Real provider: try it, but fall back to mock on any failure.
  if (p === "openai" && process.env.OPENAI_API_KEY) {
    try {
      return await chatOpenAI(messages, opts);
    } catch (e) {
      // Don't break the user request if the AI vendor is down.
      console.warn("[ai] OpenAI call failed, falling back to mock:", String(e));
    }
  }
  if (p === "gemini" && process.env.GEMINI_API_KEY) {
    try {
      return await chatGemini(messages, opts);
    } catch (e) {
      console.warn("[ai] Gemini call failed, falling back to mock:", String(e));
    }
  }

  return chatMock(messages, opts);
}

async function chatOpenAI(messages: ChatMessage[], opts?: { temperature?: number; json?: boolean }) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = (await Promise.race([
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature: opts?.temperature ?? 0.7,
        messages,
        response_format: opts?.json ? { type: "json_object" } : undefined
      })
    }),
    withTimeout(FETCH_TIMEOUT_MS)
  ])) as Response;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    model,
    provider: "openai" as const
  };
}

async function chatGemini(messages: ChatMessage[], opts?: { temperature?: number; json?: boolean }) {
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  // Gemini's chat endpoint takes a flattened `contents` array of role+parts.
  // System messages are passed via `systemInstruction`.
  const sys = messages.find((m) => m.role === "system")?.content;
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY!)}`;

  const res = (await Promise.race([
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
        contents,
        generationConfig: {
          temperature: opts?.temperature ?? 0.7,
          responseMimeType: opts?.json ? "application/json" : undefined
        }
      })
    }),
    withTimeout(FETCH_TIMEOUT_MS)
  ])) as Response;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return {
    content: text,
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
    model,
    provider: "gemini" as const
  };
}

// ---------------------- MOCK PROVIDER ----------------------
// Produces realistic, deterministic outputs that mirror what a real LLM would
// return for Bangladeshi social-commerce use cases. This powers the demo
// offline and during CI.

async function chatMock(messages: ChatMessage[], opts?: { json?: boolean }) {
  const sys = messages.find((m) => m.role === "system")?.content ?? "";
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  const lcUser = user.toLowerCase();
  const lcSys = sys.toLowerCase();

  // ---- PRODUCT DESCRIPTION ----
  if (lcSys.includes("product description") || lcSys.includes("write a product")) {
    const content = makeProductDescription(user);
    return { content, tokensIn: 60, tokensOut: 180, model: "mock", provider: "mock" as const };
  }

  // ---- FACEBOOK POST ----
  if (lcSys.includes("facebook") || lcSys.includes("social post")) {
    const content = makeFacebookPost(user);
    return { content, tokensIn: 50, tokensOut: 220, model: "mock", provider: "mock" as const };
  }

  // ---- TRANSLATION ----
  if (lcSys.includes("translator") || lcSys.includes("translate")) {
    const content = makeTranslation(user);
    return { content, tokensIn: 30, tokensOut: 60, model: "mock", provider: "mock" as const };
  }

  // ---- SUGGESTED REPLIES ----
  if (lcSys.includes("customer support") || lcSys.includes("suggested reply")) {
    const content = makeSuggestedReplies(user);
    return { content, tokensIn: 80, tokensOut: 200, model: "mock", provider: "mock" as const };
  }

  // ---- ORDER EXTRACTION ----
  if (lcSys.includes("extract order") || lcSys.includes("order details")) {
    const content = makeOrderExtraction(user);
    return { content, tokensIn: 90, tokensOut: 120, model: "mock", provider: "mock" as const };
  }

  // ---- COPILOT INSIGHT ----
  if (lcSys.includes("business copilot") || lcSys.includes("analyst")) {
    const content = makeCopilotAnswer(user);
    return { content, tokensIn: 120, tokensOut: 250, model: "mock", provider: "mock" as const };
  }

  // ---- CAMPAIGN ----
  if (lcSys.includes("campaign") || lcSys.includes("promotional")) {
    const content = makeCampaign(user);
    return { content, tokensIn: 60, tokensOut: 280, model: "mock", provider: "mock" as const };
  }

  // ---- DEFAULT ----
  return {
    content: "আমি ShopPilot AI। আমি আপনার ব্যবসার জন্য কন্টেন্ট, রিপ্লাই, ইনসাইট এবং অর্ডার প্রসেসিং-এ সাহায্য করতে পারি।\n\nI'm ShopPilot AI. I can help you with content, replies, insights and order processing.",
    tokensIn: 20,
    tokensOut: 60,
    model: "mock",
    provider: "mock" as const
  };
}

// ---------------------- MOCK CONTENT GENERATORS ----------------------

function makeProductDescription(prompt: string): string {
  const name = (prompt.match(/name[:\s-]+([^\n,]+)/i)?.[1] ?? "Premium Quality Product").trim();
  return `# ${name}

## ইংরেজি / English
Discover the perfect blend of quality and value with our **${name}**. Crafted with attention to detail, this product is designed to elevate your everyday experience. Whether you're treating yourself or gifting a loved one, ${name} delivers on every promise.

✨ **Key Features**
- Premium quality materials
- Modern, elegant design
- Long-lasting durability
- Perfect for gifting

📦 **What's in the box**
- 1 × ${name}
- Care instructions
- Authenticity card

🚚 **Delivery**
- Inside Dhaka: 24-48 hours
- Outside Dhaka: 2-3 days
- Cash on Delivery available

## বাংলা / Bangla
**${name}** — প্রিমিয়াম কোয়ালিটি, সাশ্রয়ী দামে। আপনার প্রতিদিনের জীবনকে আরও সুন্দর করতে তৈরি। অর্ডার করতে ইনবক্সে মেসেজ দিন বা অর্ডার বাটনে ক্লিক করুন ✅

⚡ সীমিত স্টক — এখনই অর্ডার করুন।`;
}

function makeFacebookPost(prompt: string): string {
  // Newer prompt format is just the topic, e.g. "Product: Hydrating Face Serum\nAudience: ..."
  // Fall back to the topic itself if the label is missing.
  const product = (
    prompt.match(/^Product:\s*(.+?)(?:\n|$)/im)?.[1] ||
    prompt.match(/^Topic:\s*(.+?)(?:\n|$)/im)?.[1] ||
    prompt.match(/product[:\s-]+([^\n,]+)/i)?.[1] ||
    prompt.split("\n")[0] ||
    "New Arrival"
  ).trim();
  return `🔥 **নতুন আগমন / New Arrival** 🔥

প্রিমিয়াম **${product}** এখন আমাদের স্টকে! 🌟

✅ ১০০% অরিজিনাল
✅ ঢাকায় ২৪ ঘণ্টায় ডেলিভারি
✅ ক্যাশ অন ডেলিভারি Available
✅ সারা বাংলাদেশে শিপিং

💰 Special Launch Price — সীমিত সময়ের জন্য!

অর্ডার করতে 👇
📩 ইনবক্সে "ORDER" লিখে পাঠান
📞 অথবা কল করুন: 01XXX-XXXXXX

#ShopPilot #OnlineShopping #Bangladesh #NewArrival #${product.replace(/\s+/g, "")}`;
}

function makeTranslation(prompt: string): string {
  // Format: "EN: <english> || BN: <bangla>" or just text
  const enMatch = prompt.match(/EN[:\s]+(.+?)(?:\|\||BN[:\s]+|$)/is);
  const bnMatch = prompt.match(/BN[:\s]+(.+?)$/is);
  if (enMatch) {
    const en = enMatch[1].trim();
    return `EN: ${en}\nBN: ${bnMock(en)}`;
  }
  if (bnMatch) {
    const bn = bnMatch[1].trim();
    return `BN: ${bn}\nEN: ${enMock(bn)}`;
  }
  return `EN: ${prompt}\nBN: ${bnMock(prompt)}`;
}

function bnMock(en: string): string {
  // Mock translation: a reasonable Bangla transliteration/wrap
  return `অনুবাদ: ${en.replace(/[^a-zA-Z0-9\s]/g, "")}`;
}
function enMock(bn: string): string {
  return `Translation: ${bn}`;
}

function makeSuggestedReplies(chat: string): string {
  const lc = chat.toLowerCase();
  if (lc.includes("price") || lc.includes("দাম") || lc.includes("কত")) {
    return JSON.stringify(
      {
        intent: "price_inquiry",
        sentiment: "neutral",
        urgency: "medium",
        replies: [
          "আপনার জন্য বিশেষ দাম ৳1,290 — অর্ডার করতে চাইলে শুধু 'OK' লিখে পাঠান।",
          "এই প্রোডাক্টটির বর্তমান দাম ৳1,290 (অরিজিনাল প্রাইস ৳1,590)। কনফার্ম করুন?",
          "Hi! Special price for you: ৳1,290 only. Free delivery inside Dhaka. Shall I confirm your order?"
        ],
        actions: [
          { type: "send_quote", label: "Send Quote" },
          { type: "create_order", label: "Create Order" }
        ],
        confidence: 0.92
      },
      null,
      2
    );
  }
  if (lc.includes("stock") || lc.includes("available") || lc.includes("স্টক")) {
    return JSON.stringify(
      {
        intent: "stock_check",
        sentiment: "neutral",
        urgency: "low",
        replies: [
          "জি, স্টকে আছে ✅ আজই অর্ডার করুন!",
          "Yes, available! Hurry — limited stock left."
        ],
        actions: [{ type: "send_product_link", label: "Send Product" }],
        confidence: 0.88
      },
      null,
      2
    );
  }
  if (lc.includes("return") || lc.includes("রিটার্ন") || lc.includes("ফেরত")) {
    return JSON.stringify(
      {
        intent: "return_request",
        sentiment: "negative",
        urgency: "high",
        replies: [
          "আমরা দুঃখিত। আপনার অর্ডার নম্বর দিলে আমরা ২৪ ঘণ্টার মধ্যে রিটার্ন প্রসেস করব।",
          "Sorry for the inconvenience. Please share your order number and we'll arrange a return pickup."
        ],
        actions: [
          { type: "create_return", label: "Create Return" },
          { type: "escalate", label: "Escalate to Manager" }
        ],
        confidence: 0.94
      },
      null,
      2
    );
  }
  return JSON.stringify(
    {
      intent: "general_inquiry",
      sentiment: "neutral",
      urgency: "low",
      replies: [
        "ধন্যবাদ মেসেজের জন্য! আমি কিভাবে সাহায্য করতে পারি? 😊",
        "Thanks for reaching out! How can I help you today?"
      ],
      actions: [{ type: "show_products", label: "Show Products" }],
      confidence: 0.75
    },
    null,
    2
  );
}

function makeOrderExtraction(chat: string): string {
  // Try to detect product names (capitalized) and quantities (numbers)
  const qtyMatch = chat.match(/(\d+)\s*(টা|টি|piece|pcs|x)?/i);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  // Very simple product detection
  const productHint =
    chat.match(/order\s+([a-z0-9\s]{3,40})/i)?.[1]?.trim() ??
    chat.match(/কিনতে চাই\s+([^\n]+)/)?.[1]?.trim() ??
    "Product";
  return JSON.stringify(
    {
      detected: true,
      confidence: 0.78,
      items: [{ name: productHint.split("\n")[0].slice(0, 60), quantity: qty, estimatedUnitPrice: 1290 }],
      needsConfirmation: true,
      suggestedAddress: "Customer address from last order",
      suggestedPayment: "cod",
      notes: "Auto-extracted. Please confirm with customer before creating order."
    },
    null,
    2
  );
}

function makeCopilotAnswer(prompt: string): string {
  const lc = prompt.toLowerCase();
  if (lc.includes("today") && (lc.includes("revenue") || lc.includes("sale") || lc.includes("আজ") || lc.includes("বিক্রি"))) {
    return `📊 **আজকের পারফরম্যান্স / Today's Snapshot**

- আজকের মোট অর্ডার: **১২টি** (গতকালের তুলনায় +২০%)
- আজকের রেভিনিউ: **৳১৮,৪৫০**
- কনভার্সেশনে কনভার্সন রেট: **৩৪%**
- পেন্ডিং পেমেন্ট: **৳৪,২০০** (৩টি অর্ডার)

💡 **রিকমেন্ডেশন**: ৩টি অর্ডারে এখনো পেমেন্ট কনফার্ম হয়নি — এক্ষুনি বিকাশ নম্বরে চেক করুন এবং কাস্টমারকে রিমাইন্ড করুন।

🎯 **অ্যাকশন আইটেম**:
1. ৫ জন পুরনো কাস্টমারকে আজকের নতুন কালেকশন পাঠান
2. স্টক কম আছে ২টি প্রোডাক্ট — আজ রিস্টক করুন`;
  }
  if (lc.includes("low stock") || lc.includes("স্টক") || lc.includes("inventory")) {
    return `📦 **স্টক ইনসাইট / Inventory Insights**

⚠️ **Low Stock Alert (2 items)**:
- Premium Silk Hijab — **3 left** (avg sells 2/day)
- Korean Face Serum — **4 left** (avg sells 3/day)

📈 **Fast Movers (last 7 days)**:
1. Wireless Earbuds — 47 sold
2. Silk Hijab Set — 38 sold
3. Vitamin C Serum — 31 sold

🐢 **Slow Movers (30+ days in stock)**:
- Floral Maxi Dress (size M) — 12 unsold, consider discount

💡 **রিস্টক সাজেশন**: আজই ৳45,000 স্টক অর্ডার করলে সপ্তাহান্তে স্টকআউট এড়ানো যাবে।`;
  }
  if (lc.includes("customer") || lc.includes("কাস্টমার")) {
    return `👥 **কাস্টমার ইনসাইট / Customer Insights**

🌟 **Top 5 Customers (by lifetime value)**:
1. Fatima Rahman — ৳24,500 (24 orders)
2. Nasreen Akter — ৳18,200 (19 orders)
3. Sumaiya Islam — ৳15,800 (16 orders)
4. Tahmina Khan — ৳12,400 (12 orders)
5. Ruma Begum — ৳10,200 (15 orders)

📊 **Cohort Analysis**:
- 30-day repeat rate: **42%**
- Avg order value: ৳1,540
- Avg days between orders: 11

💡 **অপরচুনিটি**: ১৮ জন কাস্টমার গত ৩০ দিনে অর্ডার করেননি — Win-back ক্যাম্পেইন পাঠান (15% ডিসকাউন্ট অফার)`;
  }
  return `🤖 **ShopPilot AI কোপাইলট**

আমি আপনার ব্যবসার রিয়েল-টাইম ডেটা বিশ্লেষণ করে সিদ্ধান্ত নিতে সাহায্য করি।

আপনি জিজ্ঞাসা করতে পারেন:
- "আজকের বিক্রি কেমন?"
- "কোন প্রোডাক্টের স্টক কম?"
- "আমার সেরা কাস্টমার কারা?"
- "গত ৭ দিনে কনভার্সন রেট কত?"
- "এই মাসে রিফান্ড কত?"

অথবা প্রাক-বিল্ট ইনসাইট প্যানেল দেখুন 👉`;
}

function makeCampaign(prompt: string): string {
  return `🎉 **প্রমোশনাল ক্যাম্পেইন / Promotional Campaign**

**ক্যাম্পেইন নাম**: ঈদ স্পেশাল মেগা সেল 🌙
**মেসেজ**:
> ঈদের আনন্দে সাশ্রয়ী দামে প্রিমিয়াম পণ্য! 🎁
> ২০% ডিসকাউন্ট + ফ্রি ডেলিভারি 🛍️
> কোড: EID20 — সীমিত সময়ের জন্য ⏰

**টার্গেট**: পুরনো কাস্টমার + ইনবক্সে ইনকোয়ারি করা লিড
**চ্যানেল**: Facebook Page + Messenger Broadcast + WhatsApp
**বাজেট**: ৳2,000 (Boosted Post)
**প্রত্যাশিত ROAS**: 5x

**AI অটোমেশন**:
- ২৪ ঘণ্টা পর ফলোআপ মেসেজ
- কোড EID20 ব্যবহার করলে অটো ডিসকাউন্ট
- কনভার্সন না হলে রিমাইন্ডার`;
}

// ---------------------- LOGGING ----------------------

export async function logAIUsage(opts: {
  businessId: string;
  userId?: string;
  feature: string;
  result: { tokensIn: number; tokensOut: number; model: string; provider: string };
}) {
  try {
    await prisma.aIUsageLog.create({
      data: {
        businessId: opts.businessId,
        userId: opts.userId,
        feature: opts.feature,
        model: opts.result.model,
        tokensIn: opts.result.tokensIn,
        tokensOut: opts.result.tokensOut,
        cost: ((opts.result.tokensIn + opts.result.tokensOut) / 1000) * 0.00015
      }
    });
  } catch {}
}

// ---------------------- HIGH-LEVEL HELPERS ----------------------

export async function generateProductDescription(input: { name: string; category?: string; keyPoints?: string }) {
  const prompt = `Product name: ${input.name}\nCategory: ${input.category ?? "general"}\nKey points: ${input.keyPoints ?? "premium quality, modern design, affordable"}`;
  const r = await chat(
    [
      { role: "system", content: "You are a product description writer for Bangladeshi social commerce. Output in BOTH Bangla and English. Be persuasive and include emojis." },
      { role: "user", content: prompt }
    ],
    { temperature: 0.7 }
  );
  return r;
}

export async function generateFacebookPost(input: { product: string; audience?: string; offer?: string }) {
  const prompt = `Product: ${input.product}\nAudience: ${input.audience ?? "Bangladesh women 18-45"}\nOffer: ${input.offer ?? "Cash on Delivery, free Dhaka delivery"}`;
  const r = await chat(
    [
      { role: "system", content: "You are a Facebook marketing copywriter for Bangladesh. Make it engaging with emojis, bilingual." },
      { role: "user", content: prompt }
    ]
  );
  return r;
}

export async function generateCampaign(input: { name: string; goal: string; duration: string; budget: string }) {
  const prompt = `Campaign: ${input.name}\nGoal: ${input.goal}\nDuration: ${input.duration}\nBudget: ৳${input.budget}`;
  const r = await chat(
    [
      { role: "system", content: "You are a promotional campaign planner for Bangladeshi social commerce. Be specific and bilingual." },
      { role: "user", content: prompt }
    ]
  );
  return r;
}

export async function translateText(input: { text: string; from: "bn" | "en"; to: "bn" | "en" }) {
  const prompt = input.from === "en" ? `EN: ${input.text} || BN:` : `BN: ${input.text} || EN:`;
  const r = await chat(
    [
      { role: "system", content: "You are a professional Bangla<->English translator for commerce." },
      { role: "user", content: prompt }
    ]
  );
  return r;
}

export async function suggestReplies(incoming: string) {
  const r = await chat(
    [
      {
        role: "system",
        content: `You are an AI customer support assistant for a Bangladeshi Facebook/WhatsApp seller. Given a customer message, output JSON: {intent, sentiment, urgency:low|medium|high, replies: string[3], actions: [{type, label}], confidence}. Replies must be bilingual (Bangla+English mix), warm, and conversion-focused.`
      },
      { role: "user", content: incoming }
    ],
    { json: true }
  );
  return r;
}

export async function extractOrderFromChat(message: string) {
  const r = await chat(
    [
      {
        role: "system",
        content: `You extract order details from a customer chat message. Output JSON: {detected:boolean, confidence, items:[{name,quantity,estimatedUnitPrice}], needsConfirmation, suggestedPayment, notes}`
      },
      { role: "user", content: message }
    ],
    { json: true }
  );
  return r;
}

export async function copilotAnswer(question: string, ctx: { businessName: string; metrics: any }) {
  const r = await chat(
    [
      {
        role: "system",
        content: `You are ShopPilot AI Business Copilot, an expert analyst for ${ctx.businessName}. You have access to real-time business metrics. Answer in BOTH Bangla and English. Be specific, cite numbers, and recommend concrete next actions.`
      },
      { role: "user", content: `Business metrics snapshot: ${JSON.stringify(ctx.metrics)}\n\nQuestion: ${question}` }
    ]
  );
  return r;
}
