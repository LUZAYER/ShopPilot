// src/lib/video-renderer.ts
// Canvas-based renderer for the ShopPilot AI promotional video.
// Draws 12 scenes (problem -> solution -> features -> CTA) at 1920x1080.
// Easing helpers + palette are pure and SSR-safe; drawing functions are browser-only.

export const W = 1920;
export const H = 1080;
export const FPS = 30;

// ---------- color palette ----------
export const C = {
  bg0: "#0B0F1A",        // deep navy
  bg1: "#111827",        // card dark
  bg2: "#1F2937",        // border dark
  ink: "#F8FAFC",        // white text
  mute: "#94A3B8",       // muted text
  accent: "#22D3EE",     // cyan
  accent2: "#A78BFA",    // violet
  accent3: "#34D399",    // emerald
  warn: "#FBBF24",       // amber
  bad:  "#F87171",       // red
  good: "#4ADE80",       // green
  grad1: ["#22D3EE", "#A78BFA"] as const,   // cyan -> violet
  grad2: ["#34D399", "#22D3EE"] as const,   // emerald -> cyan
  grad3: ["#FBBF24", "#F87171"] as const,   // amber -> red
};

// ---------- easing ----------
export const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out:   (t: number) => 1 - Math.pow(1 - t, 3),
  in:    (t: number) => t * t * t,
  elastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp  = (a: number, b: number, t: number) => a + (b - a) * t;
export const mapRange = (v: number, a0: number, a1: number, b0: number, b1: number) => b0 + ((v - a0) / (a1 - a0)) * (b1 - b0);

// ---------- canvas helpers ----------
export type FillTextOpts = {
  size?: number;
  color?: string;
  weight?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  font?: string;
  maxWidth?: number;
};

export function clear(ctx: CanvasRenderingContext2D) {
  ctx.save();
  // background gradient
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, C.bg0);
  g.addColorStop(1, "#0F172A");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function roundedRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function fillRound(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string,
) {
  roundedRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

export function strokeRound(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string, lineWidth = 2,
) {
  roundedRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function fillText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  opts: FillTextOpts = {},
) {
  const size = opts.size ?? 48;
  const weight = opts.weight ?? "600";
  const font = opts.font ?? `${weight} ${size}px ui-sans-serif, system-ui, "Segoe UI", "Noto Sans Bengali", sans-serif`;
  ctx.font = font;
  ctx.fillStyle = opts.color ?? C.ink;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = opts.baseline ?? "top";
  if (opts.maxWidth) ctx.fillText(text, x, y, opts.maxWidth);
  else ctx.fillText(text, x, y);
}

export function wordWrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, opts: FillTextOpts = {}) {
  const words = text.split(/\s+/);
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      fillText(ctx, line, x, yy, opts);
      line = w;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) fillText(ctx, line, x, yy, opts);
}

export function gradientText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colors: readonly [string, string], opts: FillTextOpts = {}) {
  const size = opts.size ?? 64;
  const weight = opts.weight ?? "800";
  ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, "Segoe UI", "Noto Sans Bengali", sans-serif`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = opts.baseline ?? "top";
  const w = ctx.measureText(text).width;
  const h = size * 1.4;
  const xx = opts.align === "center" ? x - w / 2 : (opts.align === "right" ? x - w : x);
  const yy = opts.baseline === "middle" ? y - h / 2 : y;
  const g = ctx.createLinearGradient(xx, yy, xx + w, yy + h);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fillText(text, xx, yy);
}

export function drawPill(
  ctx: CanvasRenderingContext2D, x: number, y: number, text: string,
  opts: { bg?: string; fg?: string; fontSize?: number; paddingX?: number; paddingY?: number },
) {
  const fs = opts.fontSize ?? 22;
  const px = opts.paddingX ?? 18;
  const py = opts.paddingY ?? 8;
  ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
  const w = ctx.measureText(text).width + px * 2;
  const h = fs + py * 2;
  fillRound(ctx, x, y, w, h, h / 2, opts.bg ?? "rgba(34,211,238,0.15)");
  fillText(ctx, text, x + w / 2, y + py, { size: fs, color: opts.fg ?? C.accent, align: "center", weight: "600" });
  return { w, h };
}

export function drawWatermark(ctx: CanvasRenderingContext2D, sceneLabel: string) {
  fillText(ctx, "ShopPilot AI", 60, H - 60, { size: 22, color: "rgba(148,163,184,0.5)", weight: "600" });
  fillText(ctx, sceneLabel, W - 60, H - 60, { size: 22, color: "rgba(148,163,184,0.5)", weight: "500", align: "right" });
  // top progress bar slot
  fillRound(ctx, 60, 50, W - 120, 4, 2, "rgba(148,163,184,0.15)");
}

// ---------- per-scene drawing functions ----------
// All draw fns receive a normalized progress `t` in [0, 1] within the scene.

function drawIntro(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  // soft glow
  const glowR = lerp(200, 700, ease.inOut(t));
  const g = ctx.createRadialGradient(W / 2, H / 2 - 50, 0, W / 2, H / 2 - 50, glowR);
  g.addColorStop(0, "rgba(34,211,238,0.35)");
  g.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // logo mark
  const markY = H / 2 - 200 + (1 - ease.out(t)) * -30;
  const markScale = lerp(0.5, 1, ease.out(t));
  ctx.save();
  ctx.translate(W / 2, markY);
  ctx.scale(markScale, markScale);
  // diamond
  ctx.rotate(Math.PI / 4);
  fillRound(ctx, -60, -60, 120, 120, 18, C.accent);
  // inner
  ctx.rotate(-Math.PI / 4);
  fillText(ctx, "S", 0, -28, { size: 96, color: C.bg0, weight: "900", align: "center" });
  ctx.restore();

  // title
  const titleY = H / 2 - 20 + (1 - ease.out(clamp(t * 1.5, 0, 1))) * 20;
  const titleOp = clamp(t * 2, 0, 1);
  ctx.save();
  ctx.globalAlpha = titleOp;
  gradientText(ctx, "ShopPilot AI", W / 2, titleY, C.grad1, { size: 132, weight: "900", align: "center" });
  ctx.restore();

  // subtitle
  const subOp = clamp((t - 0.3) * 2, 0, 1);
  ctx.save();
  ctx.globalAlpha = subOp;
  fillText(ctx, "AI-powered social commerce for Bangladesh", W / 2, titleY + 170, { size: 38, color: C.mute, align: "center", weight: "500" });
  fillText(ctx, "বাংলাদেশের হোম-বেইজড সেলারদের জন্য AI কমার্স প্ল্যাটফর্ম", W / 2, titleY + 220, { size: 30, color: C.mute, align: "center", weight: "500" });
  ctx.restore();

  drawWatermark(ctx, "Intro");
}

function drawProblem(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  // title
  const titleOp = clamp(t * 3, 0, 1);
  ctx.save();
  ctx.globalAlpha = titleOp;
  fillText(ctx, "The Problem", 100, 120, { size: 88, color: C.ink, weight: "900" });
  fillText(ctx, "আজকের সমস্যা", 100, 220, { size: 40, color: C.warn, weight: "600" });
  ctx.restore();

  // 3 problem cards
  const items = [
    { en: "Managing 5 inboxes at once",  bn: "একসাথে ৫টি ইনবক্স ম্যানেজ করা", icon: "📱" },
    { en: "Writing product copy takes hours", bn: "প্রোডাক্ট কপি লিখতে ঘণ্টা খরচ", icon: "✍️" },
    { en: "No time for analytics or follow-ups", bn: "অ্যানালিটিক্স বা ফলো-আপের সময় নেই", icon: "📊" },
  ];
  const cardW = 520;
  const cardH = 200;
  const startX = (W - cardW * 3 - 80) / 2;
  items.forEach((it, i) => {
    const delay = 0.2 + i * 0.15;
    const local = clamp((t - delay) * 2, 0, 1);
    const y = 380 + (1 - ease.out(local)) * 60;
    const x = startX + i * (cardW + 40);
    ctx.save();
    ctx.globalAlpha = local;
    fillRound(ctx, x, y, cardW, cardH, 24, C.bg1);
    strokeRound(ctx, x, y, cardW, cardH, 24, C.bad, 2);
    fillText(ctx, it.icon, x + 30, y + 30, { size: 64 });
    fillText(ctx, it.en, x + 120, y + 50, { size: 28, color: C.ink, weight: "700" });
    fillText(ctx, it.bn, x + 120, y + 95, { size: 22, color: C.mute, weight: "500" });
    fillText(ctx, "✕", x + cardW - 40, y + 30, { size: 28, color: C.bad, weight: "700", align: "center" });
    ctx.restore();
  });

  // bottom statistic
  const statOp = clamp((t - 0.7) * 3, 0, 1);
  ctx.save();
  ctx.globalAlpha = statOp;
  fillText(ctx, "73% of home-based sellers burn out within 12 months", W / 2, 720, { size: 36, color: C.warn, align: "center", weight: "700" });
  fillText(ctx, "৭৩% হোম-বেইজড সেলার ১২ মাসের মধ্যে পুড়ে যান", W / 2, 780, { size: 26, color: C.mute, align: "center", weight: "500" });
  ctx.restore();

  drawWatermark(ctx, "Problem");
}

function drawSolution(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  // left big number "1"
  const numOp = clamp(t * 2, 0, 1);
  ctx.save();
  ctx.globalAlpha = numOp;
  gradientText(ctx, "01", 200, 240, C.grad1, { size: 320, weight: "900" });
  ctx.restore();

  // title
  const titleOp = clamp((t - 0.2) * 2, 0, 1);
  ctx.save();
  ctx.globalAlpha = titleOp;
  fillText(ctx, "One platform.", 600, 280, { size: 96, color: C.ink, weight: "900" });
  fillText(ctx, "Every workflow.", 600, 400, { size: 96, color: C.ink, weight: "900" });
  fillText(ctx, "একটি প্ল্যাটফর্ম, সবকিছু।", 600, 520, { size: 44, color: C.accent, weight: "600" });
  ctx.restore();

  // checklist
  const list = [
    "Unified inbox across Messenger, WhatsApp, Facebook",
    "AI content studio — product descriptions in 30 seconds",
    "Order, inventory, reseller management in one place",
    "Business copilot that answers in Bangla",
    "Executive dashboard with predictive insights",
  ];
  list.forEach((line, i) => {
    const delay = 0.4 + i * 0.1;
    const local = clamp((t - delay) * 2, 0, 1);
    const yy = 640 + i * 56;
    ctx.save();
    ctx.globalAlpha = local;
    const x = 600 + (1 - ease.out(local)) * 30;
    fillRound(ctx, x, yy, 32, 32, 16, C.accent3);
    fillText(ctx, "✓", x + 16, yy + 4, { size: 20, color: C.bg0, weight: "900", align: "center" });
    fillText(ctx, line, x + 56, yy + 4, { size: 26, color: C.ink, weight: "500" });
    ctx.restore();
  });

  drawWatermark(ctx, "Solution");
}

function drawFeatureInbox(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  // section header pill
  drawPill(ctx, 100, 100, "FEATURE 01", { bg: "rgba(167,139,250,0.18)", fg: C.accent2 });
  fillText(ctx, "Unified Inbox", 100, 150, { size: 72, color: C.ink, weight: "900" });
  fillText(ctx, "মেসেঞ্জার, হোয়াটসঅ্যাপ, ফেসবুক — এক জায়গায়", 100, 240, { size: 28, color: C.mute, weight: "500" });

  // mock chat panel
  const px = 100, py = 320, pw = 1720, ph = 640;
  fillRound(ctx, px, py, pw, ph, 24, C.bg1);
  // left column
  const col1W = 460;
  fillRound(ctx, px + 30, py + 30, col1W, ph - 60, 16, C.bg2);
  // 5 thread items
  const threads = [
    { name: "Fatima Akter",   preview: "Is this still available?", time: "2m",  un: true,  channel: "M" },
    { name: "Rahim Mia",      preview: "Can I get 2 pieces?",    time: "5m",  un: true,  channel: "W" },
    { name: "Tania Rahman",   preview: "Size chart please",      time: "12m", un: false, channel: "F" },
    { name: "Sumon Hossain",  preview: "What about delivery?",   time: "1h",  un: false, channel: "M" },
    { name: "Nazia Tabassum", preview: "Order confirmed ✅",     time: "2h",  un: false, channel: "W" },
  ];
  threads.forEach((th, i) => {
    const delay = 0.1 + i * 0.05;
    const local = clamp((t - delay) * 2.5, 0, 1);
    const y = py + 30 + i * 110;
    ctx.save();
    ctx.globalAlpha = local;
    if (th.un) {
      fillRound(ctx, px + 40, y, col1W - 20, 96, 12, "rgba(34,211,238,0.08)");
    }
    fillRound(ctx, px + 50, y + 14, 60, 60, 30, C.grad1[0]);
    fillText(ctx, th.name[0], px + 80, y + 28, { size: 28, color: C.bg0, weight: "800", align: "center" });
    fillText(ctx, th.name, px + 130, y + 18, { size: 24, color: C.ink, weight: "700" });
    fillText(ctx, th.preview, px + 130, y + 52, { size: 18, color: C.mute, weight: "500" });
    // channel chip
    drawPill(ctx, px + 350, y + 22, th.channel, { fontSize: 14, paddingX: 10, paddingY: 4, bg: "rgba(148,163,184,0.15)", fg: C.mute });
    fillText(ctx, th.time, px + col1W - 30, y + 18, { size: 16, color: C.mute, weight: "500", align: "right" });
    if (th.un) {
      fillRound(ctx, px + col1W - 36, y + 60, 12, 12, 6, C.accent);
    }
    ctx.restore();
  });

  // right conversation column
  const rcolX = px + 30 + col1W + 30;
  const rcolW = pw - 60 - col1W - 30;
  // messages
  const msgs = [
    { from: "them", text: "ভাই, এই ড্রেসটা কি এখনো অ্যাভেইলেবল?", time: "10:42" },
    { from: "me",   text: "জি, সাইজ M আর L আছে। কোনটা নিবেন?", time: "10:43" },
    { from: "them", text: "M দিলে ২টা। ডেলিভারি চার্জ কত?", time: "10:44" },
    { from: "me",   text: "ঢাকায় ৬০ টাকা, ঢাকার বাইরে ১২০ টাকা।", time: "10:45" },
  ];
  msgs.forEach((m, i) => {
    const delay = 0.3 + i * 0.12;
    const local = clamp((t - delay) * 2, 0, 1);
    const y = py + 50 + i * 110;
    const isMe = m.from === "me";
    const bw = Math.min(rcolW - 200, ctx.measureText(m.text).width + 80);
    const bx = isMe ? rcolX + rcolW - 60 - bw : rcolX + 60;
    ctx.save();
    ctx.globalAlpha = local;
    const bg = isMe ? C.accent : C.bg2;
    const fg = isMe ? C.bg0 : C.ink;
    fillRound(ctx, bx, y, bw, 80, 16, bg);
    fillText(ctx, m.text, bx + 24, y + 26, { size: 22, color: fg, weight: "500" });
    fillText(ctx, m.time, isMe ? bx + bw - 24 : bx + bw + 12, y + 56, { size: 14, color: C.mute, weight: "500", align: isMe ? "right" : "left" });
    ctx.restore();
  });

  // AI suggested reply banner
  const aiY = py + ph - 100;
  const aiOp = clamp((t - 0.7) * 3, 0, 1);
  ctx.save();
  ctx.globalAlpha = aiOp;
  fillRound(ctx, rcolX + 40, aiY, rcolW - 80, 70, 16, "rgba(167,139,250,0.18)");
  strokeRound(ctx, rcolX + 40, aiY, rcolW - 80, 70, 16, C.accent2, 2);
  drawPill(ctx, rcolX + 60, aiY + 22, "AI SUGGEST", { fontSize: 16, paddingX: 12, paddingY: 4, bg: C.accent2, fg: C.bg0 });
  fillText(ctx, "জি, কনফার্ম করলে আজকেই শিপমেন্ট দিচ্ছি।", rcolX + 200, aiY + 22, { size: 22, color: C.ink, weight: "500" });
  ctx.restore();

  drawWatermark(ctx, "Inbox");
}

function drawFeatureAI(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  drawPill(ctx, 100, 100, "FEATURE 02", { bg: "rgba(34,211,238,0.18)", fg: C.accent });
  fillText(ctx, "AI Content Studio", 100, 150, { size: 72, color: C.ink, weight: "900" });
  fillText(ctx, "৩০ সেকেন্ডে প্রোডাক্ট ডেসক্রিপশন, ফেসবুক পোস্ট, ক্যাম্পেইন", 100, 240, { size: 28, color: C.mute, weight: "500" });

  // mock editor card
  const px = 100, py = 320, pw = 1100, ph = 640;
  fillRound(ctx, px, py, pw, ph, 24, C.bg1);
  fillText(ctx, "Generate: ", px + 40, py + 40, { size: 26, color: C.mute, weight: "600" });
  drawPill(ctx, px + 180, py + 40, "Product Description", { bg: C.accent, fg: C.bg0 });
  fillText(ctx, "Input:", px + 40, py + 110, { size: 22, color: C.mute, weight: "600" });
  fillRound(ctx, px + 40, py + 150, pw - 80, 100, 12, C.bg2);
  fillText(ctx, "Premium cotton kurti, 3 colors, BDT 850, free delivery inside Dhaka", px + 60, py + 185, { size: 22, color: C.ink, weight: "500" });
  // generate button
  const btnOp = clamp((t - 0.3) * 2, 0, 1);
  ctx.save();
  ctx.globalAlpha = btnOp;
  fillRound(ctx, px + 40, py + 280, 240, 60, 30, C.accent);
  fillText(ctx, "✨ Generate", px + 160, py + 296, { size: 22, color: C.bg0, weight: "700", align: "center" });
  ctx.restore();

  // output
  const outOp = clamp((t - 0.5) * 2, 0, 1);
  ctx.save();
  ctx.globalAlpha = outOp;
  fillRound(ctx, px + 40, py + 360, pw - 80, 240, 12, C.bg2);
  fillText(ctx, "আউটপুট:", px + 60, py + 380, { size: 20, color: C.accent, weight: "700" });
  fillText(ctx, "✨ প্রিমিয়াম কটন কুর্তি — ৩টি রঙে", px + 60, py + 410, { size: 26, color: C.ink, weight: "800" });
  fillText(ctx, "ঢাকায় ফ্রি ডেলিভারি, ক্যাশ অন ডেলিভারি। সীমিত স্টক — এখনই অর্ডার করুন।", px + 60, py + 450, { size: 20, color: C.mute, weight: "500" });
  fillText(ctx, "• Premium quality cotton", px + 60, py + 500, { size: 18, color: C.ink, weight: "500" });
  fillText(ctx, "• 3 colors: Red, Blue, Black", px + 60, py + 530, { size: 18, color: C.ink, weight: "500" });
  fillText(ctx, "• Inside Dhaka 24-48 hours", px + 60, py + 560, { size: 18, color: C.ink, weight: "500" });
  ctx.restore();

  // right side: language chips
  const rx = 1240;
  drawPill(ctx, rx, 320, "🌐 Bangla",  { bg: C.grad1[0], fg: C.bg0 });
  drawPill(ctx, rx, 380, "🇬🇧 English", { bg: C.bg2, fg: C.ink });
  drawPill(ctx, rx, 440, "📘 Marketing", { bg: C.bg2, fg: C.ink });
  drawPill(ctx, rx, 500, "📦 Product", { bg: C.bg2, fg: C.ink });
  drawPill(ctx, rx, 560, "💬 Reply", { bg: C.bg2, fg: C.ink });

  // stats below
  const sy = 700;
  const stats = [
    { v: "12",   l: "Content types" },
    { v: "30s",  l: "Avg. generation" },
    { v: "4.8★", l: "Seller rating" },
  ];
  stats.forEach((s, i) => {
    const x = rx + i * 180;
    const op = clamp((t - 0.6 - i * 0.1) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = op;
    fillText(ctx, s.v, x, sy, { size: 56, color: C.accent, weight: "900" });
    fillText(ctx, s.l, x, sy + 70, { size: 18, color: C.mute, weight: "500" });
    ctx.restore();
  });

  drawWatermark(ctx, "AI Studio");
}

function drawFeatureOrders(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  drawPill(ctx, 100, 100, "FEATURE 03", { bg: "rgba(52,211,153,0.18)", fg: C.accent3 });
  fillText(ctx, "Order & Inventory", 100, 150, { size: 72, color: C.ink, weight: "900" });
  fillText(ctx, "অর্ডার, স্টক, শিপমেন্ট — সব এক ড্যাশবোর্ডে", 100, 240, { size: 28, color: C.mute, weight: "500" });

  // 4 KPI cards
  const kpis = [
    { v: "৳48,500", l: "Today",       c: C.accent3 },
    { v: "23",      l: "Orders",      c: C.accent },
    { v: "৳2,108",  l: "Avg Order",   c: C.accent2 },
    { v: "5",       l: "Low Stock ⚠", c: C.warn },
  ];
  const cardW = 380, cardH = 180, gap = 40;
  const startX = (W - cardW * 4 - gap * 3) / 2;
  kpis.forEach((k, i) => {
    const op = clamp((t - i * 0.1) * 2, 0, 1);
    const x = startX + i * (cardW + gap);
    const y = 340 + (1 - ease.out(op)) * 40;
    ctx.save();
    ctx.globalAlpha = op;
    fillRound(ctx, x, y, cardW, cardH, 20, C.bg1);
    strokeRound(ctx, x, y, cardW, cardH, 20, k.c, 2);
    fillText(ctx, k.v, x + 30, y + 30, { size: 48, color: k.c, weight: "900" });
    fillText(ctx, k.l, x + 30, y + 100, { size: 22, color: C.mute, weight: "600" });
    ctx.restore();
  });

  // order table
  const tx = 100, ty = 580, tw = 1720, th = 360;
  fillRound(ctx, tx, ty, tw, th, 20, C.bg1);
  // header
  fillText(ctx, "Order",        tx + 30, ty + 25, { size: 18, color: C.mute, weight: "700" });
  fillText(ctx, "Customer",     tx + 280, ty + 25, { size: 18, color: C.mute, weight: "700" });
  fillText(ctx, "Items",        tx + 680, ty + 25, { size: 18, color: C.mute, weight: "700" });
  fillText(ctx, "Total",        tx + 900, ty + 25, { size: 18, color: C.mute, weight: "700" });
  fillText(ctx, "Status",       tx + 1100, ty + 25, { size: 18, color: C.mute, weight: "700" });
  fillText(ctx, "Payment",      tx + 1400, ty + 25, { size: 18, color: C.mute, weight: "700" });
  // divider
  fillRound(ctx, tx + 30, ty + 60, tw - 60, 2, 1, C.bg2);
  const rows = [
    { o: "SP-0001", c: "Fatima A.",  i: "Kurti × 2",   t: "৳1,800",  s: "Delivered",  sC: C.accent3, p: "bKash",  pC: C.accent },
    { o: "SP-0002", c: "Rahim M.",   i: "T-Shirt × 1", t: "৳650",    s: "Confirmed",  sC: C.accent,  p: "COD",    pC: C.mute },
    { o: "SP-0003", c: "Tania R.",   i: "Saree × 1",   t: "৳2,200",  s: "Shipped",    sC: C.accent2, p: "bKash",  pC: C.accent },
    { o: "SP-0004", c: "Sumon H.",   i: "Watch × 1",   t: "৳1,500",  s: "Pending",    sC: C.warn,    p: "COD",    pC: C.mute },
    { o: "SP-0005", c: "Nazia T.",   i: "Bag × 1",     t: "৳980",    s: "Confirmed",  sC: C.accent,  p: "bKash",  pC: C.accent },
  ];
  rows.forEach((r, i) => {
    const op = clamp((t - 0.3 - i * 0.05) * 2, 0, 1);
    const yy = ty + 85 + i * 52;
    ctx.save();
    ctx.globalAlpha = op;
    fillText(ctx, r.o, tx + 30, yy, { size: 20, color: C.ink, weight: "700" });
    fillText(ctx, r.c, tx + 280, yy, { size: 20, color: C.ink, weight: "500" });
    fillText(ctx, r.i, tx + 680, yy, { size: 20, color: C.ink, weight: "500" });
    fillText(ctx, r.t, tx + 900, yy, { size: 20, color: C.ink, weight: "700" });
    // status pill
    const stW = ctx.measureText(r.s).width + 28;
    fillRound(ctx, tx + 1100, yy - 4, stW, 32, 16, r.sC);
    fillText(ctx, r.s, tx + 1100 + stW / 2, yy + 3, { size: 16, color: C.bg0, weight: "700", align: "center" });
    drawPill(ctx, tx + 1400, yy - 4, r.p, { fontSize: 16, paddingX: 12, paddingY: 4, bg: r.pC, fg: C.bg0 });
    ctx.restore();
  });

  drawWatermark(ctx, "Orders");
}

function drawFeatureReseller(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  drawPill(ctx, 100, 100, "FEATURE 04", { bg: "rgba(251,191,36,0.18)", fg: C.warn });
  fillText(ctx, "Reseller Network", 100, 150, { size: 72, color: C.ink, weight: "900" });
  fillText(ctx, "রিসেলার নেটওয়ার্ক — কমিশন, পারফরম্যান্স, অনবোর্ডিং", 100, 240, { size: 28, color: C.mute, weight: "500" });

  // 4-tier diagram
  const tiers = [
    { l: "Bronze",  c: "#CD7F32",   pct: "5%",  m: 0.4 },
    { l: "Silver",  c: "#C0C0C0",   pct: "10%", m: 0.6 },
    { l: "Gold",    c: "#FFD700",   pct: "15%", m: 0.8 },
    { l: "Platinum",c: "#E5E4E2",   pct: "20%", m: 1.0 },
  ];
  const tx = 100, ty = 380, tw = 900;
  tiers.forEach((tier, i) => {
    const op = clamp((t - i * 0.1) * 2, 0, 1);
    const y = ty + i * 120;
    const w = tw * tier.m;
    ctx.save();
    ctx.globalAlpha = op;
    fillRound(ctx, tx, y, w, 90, 16, tier.c);
    fillText(ctx, tier.l, tx + 30, y + 24, { size: 28, color: C.bg0, weight: "900" });
    fillText(ctx, "Commission: " + tier.pct, tx + 30, y + 58, { size: 20, color: C.bg0, weight: "700" });
    // right info
    const resellers = ["3 active", "7 active", "4 active", "2 active"][i];
    const revenue   = ["৳12,500", "৳38,200", "৳85,000", "৳120,000"][i];
    fillText(ctx, resellers, tx + w + 20, y + 18, { size: 22, color: C.ink, weight: "700" });
    fillText(ctx, revenue,   tx + w + 20, y + 50, { size: 26, color: tier.c, weight: "900" });
    ctx.restore();
  });

  // right card: top reseller
  const rx = 1100, ry = 380, rw = 720, rh = 500;
  fillRound(ctx, rx, ry, rw, rh, 24, C.bg1);
  fillText(ctx, "🏆 Top Reseller this Month", rx + 30, ry + 30, { size: 26, color: C.ink, weight: "800" });
  // avatar
  fillRound(ctx, rx + 30, ry + 90, 100, 100, 50, C.grad2[0]);
  fillText(ctx, "F", rx + 80, ry + 110, { size: 48, color: C.bg0, weight: "900", align: "center" });
  fillText(ctx, "Fatima Akter", rx + 150, ry + 110, { size: 28, color: C.ink, weight: "800" });
  fillText(ctx, "Gold tier · 7 orders this week", rx + 150, ry + 145, { size: 18, color: C.mute, weight: "500" });
  // stats
  const subStats = [
    { l: "Orders driven", v: "47" },
    { l: "Revenue",      v: "৳68,000" },
    { l: "Commission",   v: "৳10,200" },
  ];
  subStats.forEach((s, i) => {
    const y = ry + 220 + i * 80;
    const op = clamp((t - 0.5 - i * 0.1) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = op;
    fillText(ctx, s.l, rx + 30, y, { size: 22, color: C.mute, weight: "500" });
    fillText(ctx, s.v, rx + rw - 30, y, { size: 28, color: C.accent, weight: "900", align: "right" });
    ctx.restore();
  });

  drawWatermark(ctx, "Reseller");
}

function drawFeatureCopilot(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  drawPill(ctx, 100, 100, "FEATURE 05", { bg: "rgba(167,139,250,0.18)", fg: C.accent2 });
  fillText(ctx, "Business Copilot", 100, 150, { size: 72, color: C.ink, weight: "900" });
  fillText(ctx, "বাংলায় জিজ্ঞেস করুন, তাৎক্ষণিক উত্তর পান", 100, 240, { size: 28, color: C.mute, weight: "500" });

  // chat panel
  const px = 100, py = 320, pw = 1100, ph = 640;
  fillRound(ctx, px, py, pw, ph, 24, C.bg1);
  // header
  fillRound(ctx, px, py, pw, 70, 24, "rgba(167,139,250,0.15)");
  fillRound(ctx, px + 24, py + 16, 38, 38, 19, C.accent2);
  fillText(ctx, "AI", px + 43, py + 22, { size: 18, color: C.bg0, weight: "900", align: "center" });
  fillText(ctx, "ShopPilot Copilot", px + 80, py + 24, { size: 22, color: C.ink, weight: "800" });
  fillText(ctx, "Always online", px + 80, py + 50, { size: 14, color: C.mute, weight: "500" });

  const convo = [
    { from: "me",   text: "গত ৭ দিনে কোন প্রোডাক্ট সবচেয়ে বেশি বিক্রি হয়েছে?" },
    { from: "ai",   text: "গত ৭ দিনে টপ ৩ প্রোডাক্ট:" },
    { from: "ai",   text: "১. প্রিমিয়াম কটন কুর্তি — ৳২৪,৫০০ (২৩ অর্ডার)" },
    { from: "ai",   text: "২. স্টাইলিশ টি-শার্ট — ৳১৮,২০০ (১৯ অর্ডার)" },
    { from: "me",   text: "কোন স্টক কম আছে?" },
    { from: "ai",   text: "⚠️ ৫টি প্রোডাক্টে স্টক ১০ এর নিচে। আমি অর্ডার লিস্ট তৈরি করব?" },
    { from: "me",   text: "হ্যাঁ, পাঠাও" },
    { from: "ai",   text: "✅ ৫টি আইটেমের রিঅর্ডার লিস্ট তৈরি হয়েছে। ইনবক্সে পাঠালাম।" },
  ];
  convo.forEach((m, i) => {
    const delay = 0.1 + i * 0.08;
    const local = clamp((t - delay) * 2.5, 0, 1);
    const y = py + 100 + i * 64;
    const isMe = m.from === "me";
    ctx.save();
    ctx.globalAlpha = local;
    const bg = isMe ? C.accent2 : C.bg2;
    const fg = isMe ? C.bg0 : C.ink;
    const tw2 = Math.min(pw - 200, ctx.measureText(m.text).width + 60);
    const bx = isMe ? px + pw - 60 - tw2 : px + 60;
    fillRound(ctx, bx, y, tw2, 48, 16, bg);
    fillText(ctx, m.text, bx + 24, y + 13, { size: 20, color: fg, weight: "500" });
    ctx.restore();
  });

  // right side: insights card
  const rx = 1240, ry = 320, rw = 580, rh = 640;
  fillRound(ctx, rx, ry, rw, rh, 24, C.bg1);
  fillText(ctx, "📊 ইনসাইটস", rx + 30, ry + 30, { size: 26, color: C.ink, weight: "800" });
  const insights = [
    { icon: "📈", t: "রেভিনিউ +18%",   d: "গত সপ্তাহের তুলনায়",   c: C.accent3 },
    { icon: "👥", t: "নতুন কাস্টমার +34", d: "এই মাসে যোগ হয়েছে", c: C.accent },
    { icon: "⚠️", t: "স্টক সতর্কতা",   d: "৫টি প্রোডাক্ট ১০ এর নিচে", c: C.warn },
    { icon: "🚀", t: "AI ক্যাম্পেইন সাজেশন", d: "৩টি প্রস্তুত", c: C.accent2 },
  ];
  insights.forEach((ins, i) => {
    const y = ry + 100 + i * 130;
    const op = clamp((t - 0.4 - i * 0.1) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = op;
    fillRound(ctx, rx + 30, y, rw - 60, 110, 16, C.bg2);
    fillText(ctx, ins.icon, rx + 50, y + 30, { size: 44 });
    fillText(ctx, ins.t, rx + 130, y + 25, { size: 22, color: C.ink, weight: "800" });
    fillText(ctx, ins.d, rx + 130, y + 60, { size: 16, color: C.mute, weight: "500" });
    fillRound(ctx, rx + rw - 60, y + 40, 12, 12, 6, ins.c);
    ctx.restore();
  });

  drawWatermark(ctx, "Copilot");
}

function drawFeatureAutomations(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  drawPill(ctx, 100, 100, "FEATURE 06", { bg: "rgba(34,211,238,0.18)", fg: C.accent });
  fillText(ctx, "Automation Engine", 100, 150, { size: 72, color: C.ink, weight: "900" });
  fillText(ctx, "৯টি বিল্ট-ইন অটোমেশন রুল — ইভেন্ট-ড্রিভেন ওয়ার্কফ্লো", 100, 240, { size: 28, color: C.mute, weight: "500" });

  // event flow diagram
  // left: events
  const events = [
    { t: "Order Created",  c: C.accent },
    { t: "Order Paid",     c: C.accent3 },
    { t: "Order Shipped",  c: C.accent2 },
    { t: "Product Low",    c: C.warn },
    { t: "Reseller Joined",c: C.accent },
  ];
  const ex = 100, ey = 380, ew = 280, eh = 90, egap = 24;
  events.forEach((e, i) => {
    const y = ey + i * (eh + egap);
    const op = clamp((t - i * 0.08) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = op;
    fillRound(ctx, ex, y, ew, eh, 16, C.bg1);
    strokeRound(ctx, ex, y, ew, eh, 16, e.c, 2);
    fillRound(ctx, ex + 20, y + 20, 50, 50, 25, e.c);
    fillText(ctx, "⚡", ex + 45, y + 28, { size: 26, color: C.bg0, weight: "900", align: "center" });
    fillText(ctx, e.t, ex + 90, y + 35, { size: 22, color: C.ink, weight: "700" });
    ctx.restore();
  });

  // arrows
  events.forEach((_, i) => {
    const y = ey + i * (eh + egap) + eh / 2;
    const ax = ex + ew + 10;
    const aw = 180;
    const op = clamp((t - 0.4 - i * 0.05) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = op;
    // dotted line
    ctx.strokeStyle = C.mute;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(ax, y);
    ctx.lineTo(ax + aw, y);
    ctx.stroke();
    ctx.setLineDash([]);
    // arrowhead
    ctx.fillStyle = C.mute;
    ctx.beginPath();
    ctx.moveTo(ax + aw + 12, y);
    ctx.lineTo(ax + aw, y - 8);
    ctx.lineTo(ax + aw, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // center: rules engine
  const cx = 600, cy = 380, cw = 380, ch = 530;
  fillRound(ctx, cx, cy, cw, ch, 24, C.bg1);
  strokeRound(ctx, cx, cy, cw, ch, 24, C.accent, 3);
  fillText(ctx, "🔄 Automation Engine", cx + cw / 2, cy + 30, { size: 28, color: C.ink, weight: "900", align: "center" });
  fillText(ctx, "src/lib/automation.ts", cx + cw / 2, cy + 70, { size: 16, color: C.mute, weight: "500", align: "center" });
  const rules = [
    "9 default rules",
    "Idempotent emit()",
    "Insight persistence",
    "Event bus pattern",
    "Never throws",
  ];
  rules.forEach((r, i) => {
    const y = cy + 130 + i * 60;
    const op = clamp((t - 0.5 - i * 0.08) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = op;
    fillText(ctx, "✓ " + r, cx + 40, y, { size: 20, color: C.accent, weight: "600" });
    ctx.restore();
  });

  // right: outputs
  const ox = 1240, oy = 380, ow = 580;
  const outputs = [
    { t: "📲 Customer notification", d: "Order confirmed SMS", c: C.accent3 },
    { t: "🔔 Seller alert",          d: "Low stock warning",  c: C.warn },
    { t: "📊 Dashboard insight",     d: "Revenue milestone",  c: C.accent },
    { t: "💬 Webhook to n8n",        d: "External workflow",  c: C.accent2 },
  ];
  outputs.forEach((o, i) => {
    const y = oy + i * 130;
    const op = clamp((t - 0.6 - i * 0.08) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = op;
    fillRound(ctx, ox, y, ow, 110, 16, C.bg1);
    strokeRound(ctx, ox, y, ow, 110, 16, o.c, 2);
    fillText(ctx, o.t, ox + 30, y + 30, { size: 22, color: C.ink, weight: "800" });
    fillText(ctx, o.d, ox + 30, y + 65, { size: 18, color: C.mute, weight: "500" });
    ctx.restore();
  });

  drawWatermark(ctx, "Automations");
}

function drawFeatureDashboard(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  drawPill(ctx, 100, 100, "FEATURE 07", { bg: "rgba(52,211,153,0.18)", fg: C.accent3 });
  fillText(ctx, "Executive Dashboard", 100, 150, { size: 72, color: C.ink, weight: "900" });
  fillText(ctx, "রিয়েল-টাইম KPI, রেভিনিউ চার্ট, চ্যানেল অ্যানালিটিক্স", 100, 240, { size: 28, color: C.mute, weight: "500" });

  // 4 KPI cards
  const kpis = [
    { v: "৳1,48,500", l: "Revenue 30d", trend: "+18%", c: C.accent3 },
    { v: "247",       l: "Orders 30d",  trend: "+12%", c: C.accent },
    { v: "৳601",      l: "Avg Order",   trend: "+5%",  c: C.accent2 },
    { v: "89",        l: "Customers",   trend: "+34%", c: C.warn },
  ];
  const cw = 380, ch = 170, gap = 40;
  const sx = (W - cw * 4 - gap * 3) / 2;
  kpis.forEach((k, i) => {
    const op = clamp((t - i * 0.1) * 2, 0, 1);
    const x = sx + i * (cw + gap);
    const y = 340 + (1 - ease.out(op)) * 40;
    ctx.save();
    ctx.globalAlpha = op;
    fillRound(ctx, x, y, cw, ch, 20, C.bg1);
    strokeRound(ctx, x, y, cw, ch, 20, k.c, 2);
    fillText(ctx, k.v, x + 30, y + 30, { size: 44, color: C.ink, weight: "900" });
    fillText(ctx, k.l, x + 30, y + 90, { size: 20, color: C.mute, weight: "600" });
    // trend pill
    fillRound(ctx, x + cw - 130, y + 30, 100, 36, 18, "rgba(74,222,128,0.18)");
    fillText(ctx, k.trend, x + cw - 80, y + 38, { size: 20, color: C.accent3, weight: "800", align: "center" });
    ctx.restore();
  });

  // revenue chart
  const chx = 100, chy = 560, chw = 1100, chh = 400;
  fillRound(ctx, chx, chy, chw, chh, 20, C.bg1);
  fillText(ctx, "Revenue (30d)", chx + 30, chy + 30, { size: 24, color: C.ink, weight: "800" });
  // chart line
  const pts = [40, 50, 35, 60, 75, 55, 80, 90, 70, 95, 110, 100, 120, 135, 125, 145, 130, 150, 165, 155];
  const cw2 = chw - 80, ch2 = chh - 120;
  const op = clamp((t - 0.6) * 2, 0, 1);
  ctx.save();
  ctx.globalAlpha = op;
  // grid
  ctx.strokeStyle = C.bg2;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = chy + 80 + (ch2 / 3) * i;
    ctx.beginPath();
    ctx.moveTo(chx + 40, y);
    ctx.lineTo(chx + chw - 40, y);
    ctx.stroke();
  }
  // area
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = chx + 40 + (i / (pts.length - 1)) * cw2;
    const y = chy + 80 + ch2 - (p / 180) * ch2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(chx + 40 + cw2, chy + 80 + ch2);
  ctx.lineTo(chx + 40, chy + 80 + ch2);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, chy + 80, 0, chy + 80 + ch2);
  grad.addColorStop(0, "rgba(34,211,238,0.5)");
  grad.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = grad;
  ctx.fill();
  // line
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = chx + 40 + (i / (pts.length - 1)) * cw2;
    const y = chy + 80 + ch2 - (p / 180) * ch2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // channel breakdown
  const ch2x = 1240, ch2y = 560, ch2w = 580, ch2h = 400;
  fillRound(ctx, ch2x, ch2y, ch2w, ch2h, 20, C.bg1);
  fillText(ctx, "Channel Mix", ch2x + 30, ch2y + 30, { size: 24, color: C.ink, weight: "800" });
  const channels = [
    { l: "Messenger",  pct: 0.42, c: C.accent },
    { l: "WhatsApp",   pct: 0.28, c: C.accent3 },
    { l: "Facebook",   pct: 0.18, c: C.accent2 },
    { l: "Direct",     pct: 0.12, c: C.warn },
  ];
  channels.forEach((ch, i) => {
    const y = ch2y + 100 + i * 64;
    const op = clamp((t - 0.7 - i * 0.08) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = op;
    fillText(ctx, ch.l, ch2x + 30, y, { size: 20, color: C.ink, weight: "700" });
    fillText(ctx, Math.round(ch.pct * 100) + "%", ch2x + ch2w - 30, y, { size: 20, color: ch.c, weight: "800", align: "right" });
    // bar
    const bx = ch2x + 30, by = y + 28, bw = ch2w - 60, bh = 10;
    fillRound(ctx, bx, by, bw, bh, 5, C.bg2);
    fillRound(ctx, bx, by, bw * ch.pct, bh, 5, ch.c);
    ctx.restore();
  });

  drawWatermark(ctx, "Dashboard");
}

function drawFeatureSecurity(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  drawPill(ctx, 100, 100, "FEATURE 08", { bg: "rgba(248,113,113,0.18)", fg: C.bad });
  fillText(ctx, "Security & Reliability", 100, 150, { size: 72, color: C.ink, weight: "900" });
  fillText(ctx, "প্রোম্পট ইনজেকশন গার্ড, রেট লিমিট, রিট্রাই + সার্কিট ব্রেকার", 100, 240, { size: 28, color: C.mute, weight: "500" });

  // 6 security cards in 2x3 grid
  const items = [
    { icon: "🛡️", t: "Prompt Injection Guard", d: "sanitizeForPrompt() blocks attacks", c: C.bad },
    { icon: "⏱️", t: "Rate Limiting",          d: "5 buckets per-user", c: C.warn },
    { icon: "🔒", t: "Multi-tenant Isolation", d: "Every query scoped to businessId", c: C.accent },
    { icon: "🔁", t: "withRetry()",            d: "Exponential backoff, 3 attempts", c: C.accent2 },
    { icon: "⚡", t: "withBreaker()",          d: "Circuit breaker for AI calls", c: C.accent3 },
    { icon: "📋", t: "Audit Log",              d: "107+ actions tracked", c: C.accent },
  ];
  const cw = 540, ch = 200, gx = 40, gy = 40;
  const sx = (W - cw * 3 - gx * 2) / 2;
  items.forEach((it, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = sx + col * (cw + gx);
    const y = 340 + row * (ch + gy);
    const op = clamp((t - 0.1 - i * 0.06) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = op;
    fillRound(ctx, x, y, cw, ch, 20, C.bg1);
    strokeRound(ctx, x, y, cw, ch, 20, it.c, 2);
    fillText(ctx, it.icon, x + 30, y + 30, { size: 56 });
    fillText(ctx, it.t, x + 30, y + 110, { size: 24, color: C.ink, weight: "800" });
    fillText(ctx, it.d, x + 30, y + 145, { size: 18, color: C.mute, weight: "500" });
    // check mark
    fillRound(ctx, x + cw - 50, y + 30, 30, 30, 15, it.c);
    fillText(ctx, "✓", x + cw - 35, y + 33, { size: 20, color: C.bg0, weight: "900", align: "center" });
    ctx.restore();
  });

  // bottom banner: test stats
  const by = 870, bw = 1720, bh = 100;
  fillRound(ctx, 100, by, bw, bh, 16, "rgba(52,211,153,0.12)");
  strokeRound(ctx, 100, by, bw, bh, 16, C.accent3, 2);
  const stats = [
    { v: "14",   l: "Unit tests" },
    { v: "30+",  l: "Smoke checks" },
    { v: "0",    l: "Type errors" },
    { v: "24",   l: "Routes built" },
  ];
  stats.forEach((s, i) => {
    const x = 200 + i * 380;
    const op = clamp((t - 0.7 - i * 0.05) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = op;
    fillText(ctx, s.v, x, by + 18, { size: 44, color: C.accent3, weight: "900" });
    fillText(ctx, s.l, x, by + 65, { size: 18, color: C.mute, weight: "600" });
    ctx.restore();
  });

  drawWatermark(ctx, "Security");
}

function drawClosing(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  // glow
  const glowR = lerp(200, 800, ease.inOut(t));
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, glowR);
  g.addColorStop(0, "rgba(34,211,238,0.3)");
  g.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // logo + title
  const op = clamp(t * 2, 0, 1);
  ctx.save();
  ctx.globalAlpha = op;
  fillRound(ctx, W / 2 - 60, 240, 120, 120, 18, C.accent);
  fillText(ctx, "S", W / 2, 276, { size: 96, color: C.bg0, weight: "900", align: "center" });
  gradientText(ctx, "Ready to grow?", W / 2, 420, C.grad1, { size: 110, weight: "900", align: "center" });
  fillText(ctx, "আজই শুরু করুন", W / 2, 560, { size: 48, color: C.mute, weight: "600", align: "center" });
  ctx.restore();

  // CTA button
  const btnY = 700, btnW = 480, btnH = 90;
  const btnOp = clamp((t - 0.3) * 2, 0, 1);
  const btnX = W / 2 - btnW / 2;
  ctx.save();
  ctx.globalAlpha = btnOp;
  fillRound(ctx, btnX, btnY, btnW, btnH, 45, C.accent);
  fillText(ctx, "Start Free Trial →", W / 2, btnY + 22, { size: 36, color: C.bg0, weight: "900", align: "center" });
  ctx.restore();

  // URL
  const urlOp = clamp((t - 0.5) * 2, 0, 1);
  ctx.save();
  ctx.globalAlpha = urlOp;
  fillText(ctx, "shoppilot.ai  ·  github.com/shoppilot", W / 2, 850, { size: 28, color: C.mute, weight: "600", align: "center" });
  ctx.restore();

  // tagline
  const tagOp = clamp((t - 0.7) * 3, 0, 1);
  ctx.save();
  ctx.globalAlpha = tagOp;
  fillText(ctx, "AI-powered social commerce for Bangladesh", W / 2, 920, { size: 26, color: C.mute, weight: "500", align: "center" });
  fillText(ctx, "বাংলাদেশের সেলারদের জন্য AI কমার্স", W / 2, 960, { size: 22, color: C.mute, weight: "500", align: "center" });
  ctx.restore();

  drawWatermark(ctx, "Outro");
}

function drawCredits(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx);
  fillText(ctx, "Built with", W / 2, 280, { size: 36, color: C.mute, weight: "500", align: "center" });

  const stack = [
    "Next.js 14", "TypeScript", "Prisma 5", "PostgreSQL", "NextAuth 4",
    "Gemini AI", "LangGraph", "Tailwind CSS", "shadcn/ui", "Zod",
    "PostHog", "Sentry", "Vercel",
  ];
  const cols = 4;
  const cellW = 380, cellH = 70;
  const startX = (W - cellW * cols) / 2;
  const startY = 360;
  stack.forEach((s, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = startX + col * cellW;
    const y = startY + row * cellH;
    const op = clamp((t - i * 0.04) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = op;
    fillRound(ctx, x + 20, y, cellW - 40, cellH - 10, 12, C.bg1);
    fillText(ctx, s, x + cellW / 2, y + 18, { size: 22, color: C.ink, weight: "600", align: "center" });
    ctx.restore();
  });

  // footer
  const fOp = clamp((t - 0.7) * 3, 0, 1);
  ctx.save();
  ctx.globalAlpha = fOp;
  fillText(ctx, "© 2026 ShopPilot AI", W / 2, 920, { size: 24, color: C.mute, weight: "500", align: "center" });
  fillText(ctx, "Made with ♥ in Bangladesh", W / 2, 960, { size: 22, color: C.accent, weight: "600", align: "center" });
  ctx.restore();

  drawWatermark(ctx, "Credits");
}

// ---------- scene registry ----------
export type SceneId = "intro" | "problem" | "solution" | "inbox" | "ai" | "orders" | "reseller" | "copilot" | "automations" | "dashboard" | "security" | "closing" | "credits";

export interface Scene {
  id: SceneId;
  title: string;
  bn: string;        // subtitle in Bangla
  durationSec: number;
  draw: (ctx: CanvasRenderingContext2D, t: number) => void;
  voiceoverEn: string;
  voiceoverBn: string;
}

export const SCENES: Scene[] = [
  {
    id: "intro", title: "Intro", bn: "ভূমিকা", durationSec: 10,
    draw: drawIntro,
    voiceoverEn: "ShopPilot AI — the AI-powered social commerce platform built for Bangladesh.",
    voiceoverBn: "ShopPilot AI — বাংলাদেশের হোম-বেইজড সেলারদের জন্য AI কমার্স প্ল্যাটফর্ম।",
  },
  {
    id: "problem", title: "The Problem", bn: "আজকের সমস্যা", durationSec: 14,
    draw: drawProblem,
    voiceoverEn: "Home-based sellers juggle five inboxes, write product copy for hours, and have no time for analytics. Seventy-three percent burn out within twelve months.",
    voiceoverBn: "হোম-বেইজড সেলাররা একসাথে পাঁচটা ইনবক্স ম্যানেজ করে, ঘণ্টার পর ঘণ্টা প্রোডাক্ট কপি লেখে, আর অ্যানালিটিক্সের সময়ই থাকে না। সাতাত্তর শতাংশ সেলার বারো মাসের মধ্যে পুড়ে যান।",
  },
  {
    id: "solution", title: "The Solution", bn: "সমাধান", durationSec: 16,
    draw: drawSolution,
    voiceoverEn: "One platform. Every workflow. ShopPilot AI unifies your inbox, generates content, manages orders and inventory, runs your reseller program, and answers business questions in Bangla.",
    voiceoverBn: "একটি প্ল্যাটফর্ম, সবকিছু। ShopPilot AI আপনার ইনবক্স একত্রিত করে, কন্টেন্ট তৈরি করে, অর্ডার ও ইনভেন্টরি ম্যানেজ করে, রিসেলার প্রোগ্রাম চালায়, আর বাংলায় ব্যবসার প্রশ্নের উত্তর দেয়।",
  },
  {
    id: "inbox", title: "Unified Inbox", bn: "ইউনিফায়েড ইনবক্স", durationSec: 14,
    draw: drawFeatureInbox,
    voiceoverEn: "Feature one: the Unified Inbox. Messenger, WhatsApp, and Facebook in one thread. The AI suggests replies in Bangla so you never miss a sale.",
    voiceoverBn: "ফিচার এক: ইউনিফায়েড ইনবক্স। মেসেঞ্জার, হোয়াটসঅ্যাপ, ফেসবুক — সব এক জায়গায়। AI বাংলায় রিপ্লাই সাজেস্ট করে, যাতে কোনো সেল মিস না হয়।",
  },
  {
    id: "ai", title: "AI Content Studio", bn: "AI কন্টেন্ট স্টুডিও", durationSec: 14,
    draw: drawFeatureAI,
    voiceoverEn: "Feature two: the AI Content Studio. Product descriptions, Facebook posts, marketing campaigns, and translations in thirty seconds — in Bangla and English.",
    voiceoverBn: "ফিচার দুই: AI কন্টেন্ট স্টুডিও। প্রোডাক্ট ডেসক্রিপশন, ফেসবুক পোস্ট, মার্কেটিং ক্যাম্পেইন, ট্রান্সলেশন — ত্রিশ সেকেন্ডে, বাংলা ও ইংরেজিতে।",
  },
  {
    id: "orders", title: "Order & Inventory", bn: "অর্ডার ও ইনভেন্টরি", durationSec: 14,
    draw: drawFeatureOrders,
    voiceoverEn: "Feature three: Order and Inventory. Track every order, get low-stock alerts, and process bKash payments — all from one dashboard.",
    voiceoverBn: "ফিচার তিন: অর্ডার ও ইনভেন্টরি। প্রতিটা অর্ডার ট্র্যাক করুন, লো-স্টক অ্যালার্ট পান, আর bKash পেমেন্ট প্রসেস করুন — সব এক ড্যাশবোর্ড থেকে।",
  },
  {
    id: "reseller", title: "Reseller Network", bn: "রিসেলার নেটওয়ার্ক", durationSec: 14,
    draw: drawFeatureReseller,
    voiceoverEn: "Feature four: the Reseller Network. Four commission tiers, real-time performance tracking, automated invitations.",
    voiceoverBn: "ফিচার চার: রিসেলার নেটওয়ার্ক। চারটা কমিশন টায়ার, রিয়েল-টাইম পারফরম্যান্স ট্র্যাকিং, অটোমেটেড ইনভিটেশন।",
  },
  {
    id: "copilot", title: "Business Copilot", bn: "বিজনেস কোপাইলট", durationSec: 14,
    draw: drawFeatureCopilot,
    voiceoverEn: "Feature five: the Business Copilot. Ask in Bangla — get instant answers about sales, inventory, and customers.",
    voiceoverBn: "ফিচার পাঁচ: বিজনেস কোপাইলট। বাংলায় জিজ্ঞেস করুন — সেলস, ইনভেন্টরি, কাস্টমার সম্পর্কে তাৎক্ষণিক উত্তর পান।",
  },
  {
    id: "automations", title: "Automation Engine", bn: "অটোমেশন ইঞ্জিন", durationSec: 14,
    draw: drawFeatureAutomations,
    voiceoverEn: "Feature six: the Automation Engine. Nine built-in rules, an event bus, and idempotent emits that fire notifications, alerts, and webhooks.",
    voiceoverBn: "ফিচার ছয়: অটোমেশন ইঞ্জিন। নয়টা বিল্ট-ইন রুল, ইভেন্ট বাস, আর ইডেমপোটেন্ট ইমিট — যেটা নোটিফিকেশন, অ্যালার্ট, ওয়েবহুক ফায়ার করে।",
  },
  {
    id: "dashboard", title: "Executive Dashboard", bn: "এক্সিকিউটিভ ড্যাশবোর্ড", durationSec: 14,
    draw: drawFeatureDashboard,
    voiceoverEn: "Feature seven: the Executive Dashboard. Real-time KPIs, revenue charts, and channel analytics — the pulse of your business.",
    voiceoverBn: "ফিচার সাত: এক্সিকিউটিভ ড্যাশবোর্ড। রিয়েল-টাইম KPI, রেভিনিউ চার্ট, চ্যানেল অ্যানালিটিক্স — আপনার ব্যবসার পালস।",
  },
  {
    id: "security", title: "Security & Reliability", bn: "সিকিউরিটি ও রিলায়েবিলিটি", durationSec: 14,
    draw: drawFeatureSecurity,
    voiceoverEn: "Feature eight: Security and Reliability. Prompt-injection guards, rate limiting, multi-tenant isolation, retries, and circuit breakers. Fourteen unit tests, thirty smoke checks, zero type errors.",
    voiceoverBn: "ফিচার আট: সিকিউরিটি ও রিলায়েবিলিটি। প্রোম্পট ইনজেকশন গার্ড, রেট লিমিট, মাল্টি-টেন্যান্ট আইসোলেশন, রিট্রাই, সার্কিট ব্রেকার। চোদ্দটা ইউনিট টেস্ট, ত্রিশটা স্মোক চেক, শূন্য টাইপ এরর।",
  },
  {
    id: "closing", title: "Get Started", bn: "শুরু করুন", durationSec: 12,
    draw: drawClosing,
    voiceoverEn: "Ready to grow? Start your free trial today at shoppilot dot ai.",
    voiceoverBn: "আজই শুরু করুন। shoppilot dot ai তে ফ্রি ট্রায়াল নিন।",
  },
  {
    id: "credits", title: "Credits", bn: "ক্রেডিট", durationSec: 10,
    draw: drawCredits,
    voiceoverEn: "Built with Next.js, Prisma, Gemini, and love — in Bangladesh.",
    voiceoverBn: "Next.js, Prisma, Gemini দিয়ে তৈরি — ভালোবাসা সহকারে, বাংলাদেশে।",
  },
];

export const TOTAL_DURATION = SCENES.reduce((s, sc) => s + sc.durationSec, 0);

// ---------- timeline helpers ----------
export function sceneAt(timeSec: number): { scene: Scene; localT: number; index: number } {
  let acc = 0;
  for (let i = 0; i < SCENES.length; i++) {
    const s = SCENES[i];
    if (timeSec < acc + s.durationSec) {
      return { scene: s, localT: (timeSec - acc) / s.durationSec, index: i };
    }
    acc += s.durationSec;
  }
  const last = SCENES[SCENES.length - 1];
  return { scene: last, localT: 1, index: SCENES.length - 1 };
}
