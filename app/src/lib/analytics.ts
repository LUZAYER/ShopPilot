// Business intelligence engine. Aggregates raw commerce data into the
// structured snapshots that power the Dashboard, Copilot, and Alerts.

import { prisma } from "./db";

export type BusinessSnapshot = {
  businessId: string;
  businessName: string;
  range: { from: Date; to: Date; label: string };
  revenue: number;
  orders: number;
  avgOrderValue: number;
  newCustomers: number;
  returningCustomers: number;
  conversionRate: number; // orders / unique conversations
  cancelledOrders: number;
  cancelledRate: number;
  codRate: number;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  topProducts: Array<{ id: string; name: string; unitsSold: number; units: number; revenue: number }>;
  topCustomers: Array<{ id: string; name: string; phone?: string; orders: number; spent: number }>;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
  ordersByStatus: Record<string, number>;
  paymentBreakdown: Record<string, { count: number; amount: number }>;
  channelBreakdown: Record<string, number>;
  channels: Array<{ channel: string; count: number }>;
  aiUsage: { requests: number; totalCalls: number; callsLast7d: number; tokens: number; cost: number; estimatedCost: number; features: Record<string, number> };
  unanswered: number;
  pendingPayments: number;
  pendingShipments: number;
  // Backwards-compatible field names used by the dashboard
  revenue30d: number;
  orders30d: number;
  aov: number;
  activeCustomers: number;
  business: { id: string; name: string };
  revenueGrowth: number;
  ordersGrowth: number;
  aovGrowth: number;
  customerGrowth: number;
};

export async function buildSnapshot(opts: {
  businessId: string;
  rangeDays?: number;
  label?: string;
}): Promise<BusinessSnapshot> {
  const days = opts.rangeDays ?? 30;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const [
    orders,
    products,
    conversations,
    openConvos,
    aiLogs,
    payments,
    customers,
    resellers
  ] = await Promise.all([
    prisma.order.findMany({
      where: { businessId: opts.businessId, createdAt: { gte: from } },
      include: { items: true, customer: true }
    }),
    prisma.product.findMany({ where: { businessId: opts.businessId } }),
    prisma.conversation.findMany({
      where: { businessId: opts.businessId, createdAt: { gte: from } }
    }),
    prisma.conversation.count({
      where: { businessId: opts.businessId, status: "open", unreadCount: { gt: 0 } }
    }),
    prisma.aIUsageLog.findMany({
      where: { businessId: opts.businessId, createdAt: { gte: from } }
    }),
    prisma.payment.findMany({
      where: { businessId: opts.businessId, createdAt: { gte: from } }
    }),
    prisma.customer.findMany({ where: { businessId: opts.businessId } }),
    prisma.reseller.count({ where: { businessId: opts.businessId } })
  ]);

  const revenue = orders
    .filter((o) => o.status !== "cancelled" && o.status !== "returned")
    .reduce((s, o) => s + o.total, 0);
  const orderCount = orders.length;
  const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;

  const customerSet = new Set(orders.map((o) => o.customerId));
  const allCustomerIds = new Set(customers.map((c) => c.id));
  const newCustomers = [...customerSet].filter((id) => {
    const c = customers.find((x) => x.id === id);
    return c && c.createdAt >= from;
  }).length;
  const returningCustomers = customerSet.size - newCustomers;

  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  const codOrders = orders.filter((o) => o.paymentMethod === "cod").length;

  // Product stats
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.lowStockAt).length;
  const outOfStock = products.filter((p) => p.stock === 0).length;

  // Top products
  const productSales = new Map<string, { name: string; units: number; revenue: number }>();
  for (const o of orders) {
    for (const i of o.items) {
      const cur = productSales.get(i.productId) ?? { name: i.productName, units: 0, revenue: 0 };
      cur.units += i.quantity;
      cur.revenue += i.total;
      productSales.set(i.productId, cur);
    }
  }
  const topProducts = [...productSales.entries()]
    .map(([id, v]) => ({ id, name: v.name, unitsSold: v.units, units: v.units, revenue: v.revenue }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);

  // Top customers
  const customerStats = new Map<string, { name: string; phone?: string; orders: number; spent: number }>();
  for (const o of orders) {
    if (o.status === "cancelled" || o.status === "returned") continue;
    const cur = customerStats.get(o.customerId) ?? { name: o.customer.name, phone: o.customer.phone, orders: 0, spent: 0 };
    cur.orders += 1;
    cur.spent += o.total;
    customerStats.set(o.customerId, cur);
  }
  const topCustomers = [...customerStats.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  // Revenue by day
  const dayMap = new Map<string, { revenue: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  }
  for (const o of orders) {
    if (o.status === "cancelled" || o.status === "returned") continue;
    const key = o.createdAt.toISOString().slice(0, 10);
    const cur = dayMap.get(key);
    if (cur) {
      cur.revenue += o.total;
      cur.orders += 1;
    }
  }
  const revenueByDay = [...dayMap.entries()].map(([date, v]) => ({ date, ...v }));

  // Status breakdown
  const ordersByStatus: Record<string, number> = {};
  for (const o of orders) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
  }

  // Payment breakdown
  const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
  for (const p of payments) {
    if (!paymentBreakdown[p.method]) paymentBreakdown[p.method] = { count: 0, amount: 0 };
    paymentBreakdown[p.method].count += 1;
    paymentBreakdown[p.method].amount += p.amount;
  }

  // Channel breakdown
  const channelBreakdown: Record<string, number> = {};
  for (const c of conversations) {
    channelBreakdown[c.channel] = (channelBreakdown[c.channel] ?? 0) + 1;
  }

  // AI usage
  const features: Record<string, number> = {};
  let tokens = 0;
  let cost = 0;
  for (const log of aiLogs) {
    features[log.feature] = (features[log.feature] ?? 0) + 1;
    tokens += log.tokensIn + log.tokensOut;
    cost += log.cost;
  }

  const pendingPayments = payments.filter((p) => p.status === "pending").length;
  const pendingShipments = orders.filter(
    (o) => o.status === "confirmed" || o.status === "packed"
  ).length;

  // Resolve business
  const business = await prisma.business.findUnique({ where: { id: opts.businessId } });

  // Compute growth vs prior period
  const priorFrom = new Date(from);
  priorFrom.setDate(priorFrom.getDate() - days);
  const priorOrders = await prisma.order.findMany({
    where: { businessId: opts.businessId, createdAt: { gte: priorFrom, lt: from } }
  });
  const priorRevenue = priorOrders
    .filter((o) => o.status !== "cancelled" && o.status !== "returned")
    .reduce((s, o) => s + o.total, 0);
  const priorRevenueGrowth = priorRevenue > 0 ? ((revenue - priorRevenue) / priorRevenue) * 100 : 0;
  const priorOrdersGrowth = priorOrders.length > 0 ? ((orderCount - priorOrders.length) / priorOrders.length) * 100 : 0;
  const priorAov = priorOrders.length > 0 ? priorRevenue / priorOrders.length : 0;
  const aovGrowth = priorAov > 0 ? ((avgOrderValue - priorAov) / priorAov) * 100 : 0;
  const activeCustomers = customerSet.size;
  const priorCustomers = await prisma.customer.count({
    where: { businessId: opts.businessId, createdAt: { lt: from } }
  });
  const customerGrowth = priorCustomers > 0 ? ((activeCustomers - priorCustomers) / priorCustomers) * 100 : 0;

  // AI usage stats
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const callsLast7d = aiLogs.filter((l) => l.createdAt >= sevenDaysAgo).length;

  return {
    businessId: opts.businessId,
    businessName: business?.name ?? "Your Business",
    business: { id: opts.businessId, name: business?.name ?? "Your Business" },
    range: { from, to, label: opts.label ?? `Last ${days} days` },
    revenue,
    revenue30d: revenue,
    orders: orderCount,
    orders30d: orderCount,
    avgOrderValue,
    aov: avgOrderValue,
    aovGrowth,
    newCustomers,
    returningCustomers,
    activeCustomers,
    customerGrowth,
    revenueGrowth: priorRevenueGrowth,
    ordersGrowth: priorOrdersGrowth,
    conversionRate: conversations.length > 0 ? (orderCount / conversations.length) * 100 : 0,
    cancelledOrders: cancelled,
    cancelledRate: orderCount > 0 ? (cancelled / orderCount) * 100 : 0,
    codRate: orderCount > 0 ? (codOrders / orderCount) * 100 : 0,
    totalProducts: products.length,
    lowStockProducts: lowStock,
    outOfStockProducts: outOfStock,
    topProducts,
    topCustomers,
    revenueByDay,
    ordersByStatus,
    paymentBreakdown,
    channelBreakdown,
    channels: Object.entries(channelBreakdown).map(([channel, count]) => ({ channel, count })),
    aiUsage: {
      requests: aiLogs.length,
      totalCalls: aiLogs.length,
      callsLast7d,
      tokens,
      cost,
      estimatedCost: cost,
      features
    },
    unanswered: openConvos,
    pendingPayments,
    pendingShipments
  };
}

// Generate proactive insights
export async function generateInsights(businessId: string) {
  const snap = await buildSnapshot({ businessId, rangeDays: 30 });
  const insights: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    priority: "low" | "medium" | "high" | "urgent";
    severity: "low" | "medium" | "high" | "urgent";
    data?: any;
  }> = [];
  const makeId = () => Math.random().toString(36).slice(2, 10);

  // Low stock alert
  if (snap.lowStockProducts > 0) {
    const priority = snap.lowStockProducts > 5 ? "high" : "medium";
    insights.push({
      id: makeId(),
      type: "inventory",
      title: `${snap.lowStockProducts}টি প্রোডাক্ট স্টক কম`,
      body: `কিছু পণ্য স্টকআউট হতে চলেছে। আজই রিস্টক প্ল্যান করুন যাতে বিক্রি মিস না হয়।`,
      priority,
      severity: priority
    });
  }

  // Unanswered messages
  if (snap.unanswered > 5) {
    insights.push({
      id: makeId(),
      type: "ops",
      title: `${snap.unanswered}টি কনভার্সেশন অনুত্তরিত`,
      body: `গড় রেসপন্স টাইম বাড়লে কনভার্সন কমে। AI সাজেস্টেড রিপ্লাই ব্যবহার করে দ্রুত রিপ্লাই দিন।`,
      priority: "high",
      severity: "high"
    });
  }

  // Revenue opportunity
  if (snap.revenue > 0) {
    insights.push({
      id: makeId(),
      type: "opportunity",
      title: "আপনার টপ কাস্টমারদের রিপ্লেস ক্যাম্পেইন পাঠান",
      body: `${snap.topCustomers.length} জন হাই-ভ্যালু কাস্টমারকে ১৫% লয়্যালটি ডিসকাউন্ট অফার করলে আনুমানিক ৳${Math.round(snap.revenue * 0.15).toLocaleString()} অতিরিক্ত রেভিনিউ সম্ভব।`,
      priority: "medium",
      severity: "medium"
    });
  }

  // COD risk
  if (snap.codRate > 80 && snap.cancelledRate > 10) {
    insights.push({
      id: makeId(),
      type: "alert",
      title: "COD ক্যান্সেলেশন বেশি",
      body: `আপনার ${snap.codRate.toFixed(0)}% অর্ডার COD এবং ${snap.cancelledRate.toFixed(0)}% ক্যান্সেল হচ্ছে। অর্ডার কনফার্ম করার সময় ফোনে ভেরিফাই করুন বা অগ্রিম পেমেন্ট ডিসকাউন্ট দিন।`,
      priority: "high",
      severity: "high"
    });
  }

  // AI adoption
  if (snap.aiUsage.requests === 0) {
    insights.push({
      id: makeId(),
      type: "opportunity",
      title: "AI ফিচার ব্যবহার শুরু করুন",
      body: "AI Content Studio, AI Replies, এবং Copilot আপনার ৯০% ম্যানুয়াল কাজ অটোমেট করতে পারে। আজই প্রথম AI কন্টেন্ট জেনারেট করুন।",
      priority: "low",
      severity: "low"
    });
  } else {
    insights.push({
      id: makeId(),
      type: "opportunity",
      title: `আপনি এই মাসে ${snap.aiUsage.requests}টি AI রিকোয়েস্ট ব্যবহার করেছেন`,
      body: `AI আপনার ${Math.round(snap.aiUsage.tokens / 1000)}K টোকেন প্রসেস করেছে। আরও বেশি ব্যবহার করলে আরও বেশি সময় বাঁচবে।`,
      priority: "low",
      severity: "low"
    });
  }

  return insights;
}
