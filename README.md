<p align="center">
  <img src="https://img.shields.io/badge/ShopPilot-AI-FF6B35?style=for-the-badge&logo=sparkles&logoColor=white" alt="ShopPilot AI" />
</p>

<h1 align="center">🛒 ShopPilot AI</h1>

<p align="center">
  <strong>AI-powered social commerce platform for Bangladeshi home-based sellers.</strong><br/>
  A complete production MVP — unified inbox, AI content studio, order & inventory management, reseller program, business copilot, and executive dashboard — in one Next.js 14 app with a Bangla-first UI.
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js" alt="Next.js" /></a>
  <a href="https://typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://prisma.io"><img src="https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" /></a>
  <a href="https://next-auth.js.org"><img src="https://img.shields.io/badge/NextAuth-4.24-7C3AED?style=flat-square" alt="NextAuth" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" /></a>
  <a href="https://recharts.org"><img src="https://img.shields.io/badge/Recharts-2.13-FF7300?style=flat-square" alt="Recharts" /></a>
  <img src="https://img.shields.io/badge/License-MIT-22C55E?style=flat-square" alt="MIT License" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Environment Variables](#-environment-variables)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Architecture](#-architecture)
- [Security](#-security)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Roadmap](#️-roadmap)
- [License](#-license)
- [Author](#-author)

---

## 🌟 Overview

**ShopPilot AI** is a full-stack, AI-enhanced social commerce management platform purpose-built for Bangladesh's booming home-based seller ecosystem. It consolidates scattered workflows — from handling customer messages across Messenger, WhatsApp, and Instagram to managing orders, inventory, resellers, and AI-powered content creation — into a single, cohesive application.

The platform features a **Bangla-first UI** with full bilingual support, integrations with Bangladeshi payment gateways (bKash, Nagad) and courier services (Pathao, Steadfast, RedX), and a pluggable AI layer that works offline with mock providers or connects to OpenAI-compatible APIs.

---

## ✨ Features

### Seven Core Modules

| # | Module | Route | Description |
|---|--------|-------|-------------|
| 1 | **Executive Dashboard** | `/dashboard` | Revenue, orders, AOV, channel split, top products, low stock alerts, and recent AI-generated insights — all from live database aggregations |
| 2 | **AI Content Studio** | `/content` | Generates product descriptions, Facebook posts, and 7-day campaign briefs in Bangla/English with tone and audience targeting |
| 3 | **Unified Inbox** | `/inbox` | Cross-channel conversation view (Messenger / WhatsApp / Instagram / Web) with AI reply suggestions, sentiment analysis, and intent detection |
| 4 | **Order Management** | `/orders` | Full order lifecycle — new → confirmed → packed → shipped → delivered, with linked payments, shipments, and courier tracking |
| 5 | **Inventory** | `/products` | Product catalog with stock movements, low-stock alerts, SKU management, AI descriptions, and demand forecasting |
| 6 | **Reseller Program** | `/resellers` | Tiered resellers (Bronze / Silver / Gold) with commission tracking, referral codes, and payout management |
| 7 | **Business Copilot** | `/copilot` | Conversational AI that answers questions from your live business data using RAG-style querying |

### Platform Highlights

- 🇧🇩 **Bangla-first UI** — Full `bn`/`en` bilingual support with `i18n.ts` translations
- 🤖 **Pluggable AI** — Mock provider for offline dev, OpenAI-compatible for production
- 📊 **Real-time Analytics** — Live dashboard with Recharts visualizations
- 🔐 **Enterprise Security** — Rate limiting, prompt injection sanitization, audit logging, multi-tenant RLS
- 🔄 **Automation Engine** — Event-driven bus with 9 built-in rules for notifications and insights
- ⚡ **Reliability Primitives** — Retry with exponential backoff, circuit breaker, fire-and-forget wrappers
- 📱 **Responsive Design** — Mobile-ready with Tailwind + Radix UI
- 🚀 **Production Ready** — Vercel deployment config, Sentry error tracking, PostHog analytics

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Next.js 14.2](https://nextjs.org) — App Router, RSC, Server Actions |
| **Language** | TypeScript 5.6 (strict mode) |
| **Database** | [Prisma 5.22](https://prisma.io) + SQLite (file-based, zero-config) |
| **Auth** | [NextAuth 4.24](https://next-auth.js.org) — Credentials + bcrypt + JWT |
| **Styling** | Tailwind CSS 3.4 + Radix UI primitives + `class-variance-authority` |
| **Charts** | [Recharts 2.13](https://recharts.org) |
| **Validation** | [Zod](https://zod.dev) — Runtime schema validation |
| **Forms** | React Hook Form + `@hookform/resolvers` |
| **Icons** | [Lucide React](https://lucide.dev) |
| **AI** | Pluggable provider (mock by default, OpenAI-compatible when keys are set) |
| **Integrations** | bKash / Nagad / Pathao / Steadfast / RedX (mocked; real keys swap in `.env`) |
| **Observability** | Sentry (error tracking) + PostHog (product analytics) — env-gated |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/shoppilot-ai.git
cd shoppilot-ai/app

# 2. Install dependencies
npm install

# 3. Set up the database (creates SQLite file + applies schema)
npx prisma db push

# 4. Seed demo data
# Creates: 1 owner · 1 business · 10 products · 8 customers · 14 orders · 6 conversations · 3 resellers
npx tsx prisma/seed.ts

# 5. Start development server
npm run dev
# → http://localhost:3000
```

### One-shot Reset & Run

```bash
npm run db:reset && npm run dev
```

### Demo Credentials

| Field | Value |
|-------|-------|
| Email | `demo@shoppilot.ai` |
| Password | `demo1234` |

---

## 📁 Project Structure

```
app/
├── prisma/
│   ├── schema.prisma              # 18 models (User, Business, Product, Order, ...)
│   ├── seed.ts                    # Idempotent demo-data seeder
│   └── dev.db                     # SQLite database file
├── scripts/
│   └── ensure-port.mjs            # Pre-dev port availability check
├── src/
│   ├── app/
│   │   ├── (dashboard)/           # Authenticated app shell with sidebar
│   │   │   ├── dashboard/         # Executive overview
│   │   │   ├── content/           # AI Content Studio
│   │   │   ├── inbox/             # Unified inbox + [id] thread view
│   │   │   ├── orders/            # Order list + [id] detail
│   │   │   ├── products/          # Inventory management
│   │   │   ├── resellers/         # Reseller program
│   │   │   ├── copilot/           # Business Copilot
│   │   │   ├── video-studio/      # Video content tools
│   │   │   └── layout.tsx         # Dashboard layout wrapper
│   │   ├── api/                   # REST + AI API routes
│   │   │   ├── ai/                # content, campaign, facebook-post, translate
│   │   │   ├── analytics/         # Aggregate snapshot builder
│   │   │   ├── auth/              # NextAuth endpoints
│   │   │   ├── automations/       # Event bus stream
│   │   │   ├── conversations/     # Messages + AI suggest
│   │   │   ├── copilot/           # Business Q&A
│   │   │   ├── insights/          # AI-generated business insights
│   │   │   ├── integrations/      # bKash payment
│   │   │   ├── orders/            # CRUD + status transitions
│   │   │   ├── products/          # CRUD + stock management
│   │   │   ├── resellers/         # Invite + manage
│   │   │   └── video/             # Video generation
│   │   ├── login/                 # Auth page
│   │   ├── layout.tsx             # Root layout
│   │   ├── globals.css            # Global styles
│   │   ├── error.tsx              # Error boundary
│   │   └── not-found.tsx          # 404 page
│   ├── components/
│   │   ├── ui/                    # Button, Card, Input, Badge, Tabs, Skeleton
│   │   ├── charts/                # Recharts wrapper components
│   │   ├── sidebar.tsx            # Navigation sidebar
│   │   ├── topbar.tsx             # Top navigation bar
│   │   ├── content-studio.tsx     # AI content generation UI
│   │   ├── copilot-chat.tsx       # Copilot chat interface
│   │   ├── conversation-thread.tsx # Message thread view
│   │   ├── reply-composer.tsx     # Message reply composer
│   │   ├── orders-table.tsx       # Orders data table
│   │   ├── order-actions.tsx      # Order action buttons
│   │   ├── product-card.tsx       # Product display card
│   │   ├── reseller-list.tsx      # Reseller listing
│   │   ├── empty-state.tsx        # Empty state placeholder
│   │   ├── error-boundary.tsx     # Error boundary component
│   │   └── providers.tsx          # Context providers
│   └── lib/
│       ├── ai.ts                  # Provider-agnostic AI client (mock / OpenAI)
│       ├── ai-client.ts           # AI client utilities
│       ├── analytics.ts           # Dashboard snapshot builder
│       ├── auth.ts                # NextAuth configuration
│       ├── automation.ts          # Event-driven automation engine
│       ├── db.ts                  # Prisma singleton
│       ├── i18n.ts                # Internationalization (Bangla/English)
│       ├── integrations.ts        # Payment & courier integrations
│       ├── monitoring.ts          # Sentry + PostHog observability shim
│       ├── reliability.ts         # Retry, circuit breaker, safeAsync
│       ├── security.ts            # Auth guards, rate limiting, sanitization
│       ├── session.ts             # requireBusiness() / requireOwner()
│       ├── utils.ts               # cn(), shortId(), relativeTime(), currency
│       ├── video-encoder.ts       # Video encoding utilities
│       ├── video-renderer.ts      # Video rendering engine
│       └── voiceover.ts           # Voice-over generation
├── tests/
│   ├── unit/
│   │   ├── reliability.test.mjs   # 5 cases — withRetry, withBreaker, safeAsync
│   │   ├── automation.test.mjs    # 3 cases — emit, checkLowStock, emit-on-low-stock
│   │   └── security.test.mjs      # 6 cases — parseBody, sanitize, rateLimit, Schemas
│   └── integration/
│       └── run-smoke.sh           # 30-check end-to-end smoke test
├── smoke-commerce.mjs             # Smoke test runner
├── .env                           # Environment configuration
├── next.config.mjs                # Next.js configuration
├── tailwind.config.ts             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript configuration
├── vercel.json                    # Vercel deployment config
├── postcss.config.mjs             # PostCSS configuration
├── sentry.client.config.ts        # Sentry client-side config
├── sentry.server.config.ts        # Sentry server-side config
└── posthog.client.config.ts       # PostHog client-side config
```

---

## 🔐 Environment Variables

Create a `.env` file in the `app/` directory (defaults shown — works fully offline):

```dotenv
# ── Database ──────────────────────────────────────────────────
DATABASE_URL="file:./dev.db"

# ── Authentication ────────────────────────────────────────────
NEXTAUTH_SECRET="<change-me>"          # Generate: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# ── AI Provider ───────────────────────────────────────────────
AI_PROVIDER="mock"                     # "mock" = offline, "openai" = real API
OPENAI_API_KEY=""

# ── Bangladesh Integrations (optional, mocked by default) ────
BKASH_APP_KEY=""
BKASH_APP_SECRET=""
NAGAD_MERCHANT_ID=""
PATHAO_API_KEY=""
STEADFAST_API_KEY=""
REDX_API_KEY=""

# ── Observability (optional, no-op when empty) ───────────────
NEXT_PUBLIC_SENTRY_DSN=""              # Client + server error tracking
SENTRY_DSN=""                          # Server-only DSN override
NEXT_PUBLIC_POSTHOG_KEY=""             # Product analytics
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"
```

> **Production tip:** Set a real `NEXTAUTH_SECRET` and flip `AI_PROVIDER=openai` with a valid API key.

---

## 🗄️ Database Schema

The Prisma schema defines **18 models** organized across the platform's modules:

| Category | Models |
|----------|--------|
| **Identity & Multi-tenancy** | `User`, `Business` |
| **Inventory** | `Product`, `StockMovement` |
| **Customers** | `Customer` |
| **Inbox** | `Conversation`, `Message` |
| **Orders** | `Order`, `OrderItem`, `Shipment`, `Payment` |
| **Resellers** | `Reseller`, `ResellerProduct`, `Commission` |
| **AI Content** | `ContentPost`, `AIUsageLog` |
| **Insights** | `Insight` |
| **Security** | `AuditLog` |

---

## 🔌 API Reference

All API routes are located under `src/app/api/` and are protected with auth, rate limiting, validation, and audit logging.

| Group | Endpoint | Method | Description |
|-------|----------|--------|-------------|
| **AI** | `/api/ai/copilot` | POST | Business Q&A via RAG-style querying |
| | `/api/ai/content` | POST | Generate product descriptions & posts |
| | `/api/ai/insights` | POST | Generate AI business insights |
| | `/api/ai/translate` | POST | Bangla ↔ English translation |
| **Chat** | `/api/conversations` | GET/POST | List/create conversations |
| | `/api/conversations/[id]/messages` | GET | Get conversation messages |
| | `/api/conversations/reply-suggest` | POST | AI-powered reply suggestions |
| **Commerce** | `/api/products` | GET/POST | Product CRUD + stock management |
| | `/api/orders` | GET/POST | Order CRUD with dedup & stock guards |
| | `/api/orders/[id]` | GET/PATCH | Order detail + status transitions |
| **Resellers** | `/api/resellers/invite` | POST | Invite new reseller |
| **Analytics** | `/api/analytics` | GET | Dashboard aggregate snapshot |
| | `/api/insights` | GET/POST | Business insights feed |
| **Integrations** | `/api/integrations/bkash` | POST | bKash payment processing |
| **Automations** | `/api/automations` | GET | Event bus notification stream |
| **Auth** | `/api/auth/*` | * | NextAuth endpoints |

---

## 🧠 Architecture

### Single-Tenant Session Model

Every authenticated request resolves to one `Business` via `requireBusiness()`. All Prisma queries scope by `businessId` — there is no global query path, ensuring strict tenant isolation.

### AI Provider Abstraction

`src/lib/ai.ts` exports a single `generate({ system, prompt, json })` function. When `AI_PROVIDER=mock`, it returns deterministic template-based responses (zero network). When `AI_PROVIDER=openai`, it calls an OpenAI-compatible chat-completions endpoint. Swapping to Anthropic, Gemini, or a local model is a one-file change.

### Analytics Snapshot

`src/lib/analytics.ts` builds a single typed object (`revenue`, `orders`, `aov`, `channels[]`, `topProducts[]`, `lowStock[]`, `recentInsights[]`) consumed by `/dashboard` and `/api/analytics`, keeping chart components decoupled from the query layer.

### Automation Engine (Event Bus)

`src/lib/automation.ts` is a lightweight in-process event bus that decouples business events from notifications/insights:

| Event | Trigger | Default Rules |
|-------|---------|---------------|
| `order.created` | `POST /api/orders` | WhatsApp notify + sales spike insight |
| `order.paid` | `PATCH /api/orders/:id` | WhatsApp confirm + paid insight |
| `order.shipped` | `PATCH /api/orders/:id` | WhatsApp ship + copilot memo |
| `order.cancelled` | `PATCH /api/orders/:id` | Copilot risk memo |
| `product.created` | `POST /api/products` | Low stock check |
| `payment.failed` | `POST /api/integrations/bkash` | Ops alert + fraud check |
| `reseller.invited` | `POST /api/resellers/invite` | Welcome WhatsApp |

### Reliability Primitives

`src/lib/reliability.ts` provides three call-site helpers:

- **`withRetry(fn, opts)`** — Exponential backoff with caller-supplied retry predicate
- **`withBreaker(key, fn, opts)`** — In-process circuit breaker (opens after threshold failures)
- **`safeAsync(promise)`** — Fire-and-forget wrapper that logs but never throws

---

## 🔐 Security

Every API route passes through `src/lib/security.ts` which layers five concerns:

| Concern | Implementation |
|---------|----------------|
| **Authentication** | `getServerSession()` → 401/403 enforcement |
| **Validation** | Zod schema per endpoint → 400 with `issues[]` |
| **Rate Limiting** | Per-`(userId, action)` sliding window (60/min default, 20/min for AI) |
| **Sanitization** | Strips 10+ prompt-injection patterns before LLM calls |
| **Audit Logging** | `AuditLog` row per protected call (action, businessId, userId, IP, metadata) |

All 14 API routes are protected. Two guard functions:

- **`protectRoute(req, action, schema?, opts?)`** — For body-bearing requests (POST/PATCH/PUT)
- **`requireAuth(req, action, opts?)`** — For GET-only routes

### Edge-Case Guards

- **Duplicate-order dedup** — Fingerprints line items; short-circuits if identical order created within 60s
- **Negative-stock guard** — Transactional stock decrement; aborts with 400 if insufficient stock

---

## 🧪 Testing

```bash
# Run all 14 unit tests
npm test

# Run 30-check end-to-end smoke tests (requires running dev server)
npm run test:smoke

# TypeScript type checking
npm run typecheck
```

### Test Coverage

| Suite | Cases | Covers |
|-------|-------|--------|
| `reliability.test.mjs` | 5 | `withRetry`, `withBreaker`, `safeAsync` |
| `automation.test.mjs` | 3 | `emit`, `checkLowStock`, emit-on-low-stock |
| `security.test.mjs` | 6 | `parseBody`, `sanitizeForPrompt`, `rateLimit`, Zod schemas |
| `smoke-commerce.mjs` | 30 | Happy paths, 400/401/404 errors, cross-tenant isolation, idempotent bKash |

### Verification Matrix

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run build` | ✅ 23 routes built, 0 errors |
| `npx tsx prisma/seed.ts` | ✅ Idempotent |
| All dashboard routes | ✅ 200 OK |
| All API endpoints | ✅ 200, real data |
| Unit tests (`npm test`) | ✅ 14/14 pass |
| Smoke tests | ✅ 30/30 pass |
| Bangla content rendering | ✅ সব ঠিক আছে |

---

## 🚀 Deployment

### Production Build

```bash
npm run build      # Generates Prisma client + Next.js production build
npm run start      # Serves on port 3000
```

### Vercel

The project includes a `vercel.json` with:

- **Region:** `sin1` (Singapore — closest to Bangladesh)
- **Function timeout:** 30 seconds
- **Security headers:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
- **Build command:** `prisma generate && next build`

### Observability (Optional)

- **Sentry** — Set `NEXT_PUBLIC_SENTRY_DSN` for client+server error tracking
- **PostHog** — Set `NEXT_PUBLIC_POSTHOG_KEY` for product analytics
- Both are env-gated no-ops when keys are empty — zero cost in dev

---

## 🛣️ Roadmap

Planned features beyond the current MVP:

- [ ] Real bKash / Nagad / Pathao API integration (currently mocked)
- [ ] Webhook receivers for inbound Messenger / WhatsApp messages
- [ ] Real-time updates (WebSockets / Pusher)
- [ ] Mobile app (React Native) reusing the same `/api/*` endpoints
- [ ] Multi-tenant business switching
- [ ] AI image generation for product photos
- [ ] Customer-facing storefront
- [ ] Automated delivery-status sync with courier APIs
- [ ] Advanced video content generation tools

---

## 📄 License

MIT — built as a production MVP. Use it, fork it, ship it.

---

## 👤 Author

**Reyazul Islam**

*Cybersecurity Engineer | Full-Stack Developer | AI & Innovation Enthusiast*

<p>
  📧 <strong>Email:</strong> <a href="mailto:luzayer.pro@gmail.com">luzayer.pro@gmail.com</a><br/>
  📱 <strong>Phone:</strong> +880 1517-949503
</p>

Passionate about building innovative solutions at the intersection of **Artificial Intelligence**, **Cybersecurity**, **Healthcare Technology**, and **Workflow Automation**. Experienced in full-stack development, CTF competitions, reverse engineering, cryptography, and scalable SaaS platform development.

> For inquiries, collaborations, or contributions, feel free to reach out.

---

<p align="center">
  Built with ❤️ in Bangladesh 🇧🇩
</p>
