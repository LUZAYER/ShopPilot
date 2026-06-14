import { requireBusiness } from "@/lib/session";
import { buildSnapshot, generateInsights } from "@/lib/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBDT, relativeTime } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, ShoppingCart, Users, DollarSign, Package, Sparkles, AlertTriangle
} from "lucide-react";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { ChannelChart } from "@/components/charts/channel-chart";
import Link from "next/link";

export default async function DashboardPage() {
  const { businessId } = await requireBusiness();
  const [snapshot, insights] = await Promise.all([
    buildSnapshot({ businessId }),
    generateInsights(businessId)
  ]);

  const kpis = [
    {
      label: "Revenue (30d)", value: formatBDT(snapshot.revenue30d), icon: DollarSign,
      trend: snapshot.revenueGrowth, color: "from-green-500 to-emerald-600"
    },
    {
      label: "Orders (30d)", value: snapshot.orders30d.toString(), icon: ShoppingCart,
      trend: snapshot.ordersGrowth, color: "from-blue-500 to-cyan-600"
    },
    {
      label: "Avg Order Value", value: formatBDT(snapshot.aov), icon: TrendingUp,
      trend: snapshot.aovGrowth, color: "from-purple-500 to-pink-600"
    },
    {
      label: "Active Customers", value: snapshot.activeCustomers.toString(), icon: Users,
      trend: snapshot.customerGrowth, color: "from-orange-500 to-red-500"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            পরিচালন সারসংক্ষেপ · {snapshot.business.name}
          </p>
        </div>
        <Link href="/copilot">
          <Badge variant="default" className="cursor-pointer">
            <Sparkles className="h-3 w-3 mr-1" /> Ask Copilot
          </Badge>
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const positive = k.trend >= 0;
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="text-2xl font-bold mt-1">{k.value}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {positive ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      )}
                      <span className={`text-xs font-medium ${positive ? "text-green-600" : "text-red-600"}`}>
                        {positive ? "+" : ""}{k.trend.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${k.color} flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue trend</CardTitle>
            <CardDescription>গত ৩০ দিনের আয়ের প্রবণতা</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={snapshot.revenueByDay} />
          </CardContent>
        </Card>

        {/* Channel breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Channels</CardTitle>
            <CardDescription>চ্যানেল অনুযায়ী বিভাজন</CardDescription>
          </CardHeader>
          <CardContent>
            <ChannelChart data={snapshot.channels} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top products */}
        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <CardDescription>সবচেয়ে বেশি বিক্রি হওয়া পণ্য</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.topProducts.slice(0, 5).map((p, i) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-md bg-green-50 text-green-700 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.units} units</p>
                  </div>
                </div>
                <p className="text-sm font-semibold">{formatBDT(p.revenue)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top customers</CardTitle>
            <CardDescription>সবচেয়ে মূল্যবান গ্রাহক</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.topCustomers.slice(0, 5).map((c, i) => (
              <div key={c.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {c.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name || c.phone}</p>
                    <p className="text-xs text-muted-foreground">{c.orders} orders</p>
                  </div>
                </div>
                <p className="text-sm font-semibold">{formatBDT(c.spent)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-600" />
              AI insights
            </CardTitle>
            <CardDescription>স্বয়ংক্রিয় পরামর্শ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.slice(0, 4).map((ins) => (
              <div
                key={ins.id}
                className="p-3 rounded-md border bg-gradient-to-br from-green-50/50 to-emerald-50/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{ins.title}</p>
                  {ins.severity === "high" && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{ins.body}</p>
              </div>
            ))}
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                সব ঠিক আছে — কোন সতর্কতা নেই ✓
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI usage summary */}
      {snapshot.aiUsage.totalCalls > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">AI usage this month</p>
                  <p className="text-xs text-muted-foreground">
                    {snapshot.aiUsage.totalCalls} calls · est. cost {formatBDT(snapshot.aiUsage.estimatedCost)}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">+{snapshot.aiUsage.callsLast7d} in last 7 days</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
