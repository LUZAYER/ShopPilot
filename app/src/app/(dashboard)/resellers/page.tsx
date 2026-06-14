import { requireBusiness } from "@/lib/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBDT, relativeTime } from "@/lib/utils";
import { Network, TrendingUp, Users, Award, Plus } from "lucide-react";
import { ResellerList } from "@/components/reseller-list";
import { EmptyState } from "@/components/empty-state";

export default async function ResellersPage() {
  const { businessId } = await requireBusiness();
  const resellers = await db.reseller.findMany({
    where: { businessId },
    include: {
      user: true,
      products: { include: { product: true } },
      commissions: true,
      orders: { include: { items: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const totalSales = resellers.reduce((s, r) => s + r.orders.reduce((a, o) => a + o.total, 0), 0);
  const totalCommission = resellers.reduce((s, r) => s + r.commissions.reduce((a, c) => a + c.amount, 0), 0);
  const activeResellers = resellers.filter((r) => r.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reseller Network</h1>
          <p className="text-sm text-muted-foreground">রিসেলার নেটওয়ার্ক ও কমিশন ব্যবস্থাপনা</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" /> Invite reseller
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Total resellers</p>
            <p className="text-2xl font-bold mt-1">{resellers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{activeResellers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Reseller sales</p>
            <p className="text-2xl font-bold mt-1">{formatBDT(totalSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Total commission</p>
            <p className="text-2xl font-bold mt-1">{formatBDT(totalCommission)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resellers</CardTitle>
        </CardHeader>
        <CardContent>
          {resellers.length === 0 ? (
            <EmptyState
              icon={<Network className="h-5 w-5" />}
              title="No resellers yet"
              body="Invite your first reseller to start tracking sales and commissions."
            />
          ) : (
          <ResellerList
            resellers={resellers.map((r) => {
              const u = r.user;
              return {
                id: r.id,
                name: r.name || u?.name || u?.email || "—",
                email: u?.email || r.email || "—",
                phone: u?.phone || r.phone || "",
                city: r.city || "—",
                status: r.status,
                tier: r.tier,
                rate: r.commissionRate,
                sales: r.orders.reduce((a: number, o: { total: number }) => a + o.total, 0),
                orders: r.orders.length,
                commission: r.commissions.reduce((a: number, c: { amount: number }) => a + c.amount, 0),
                joinedAt: r.createdAt.toISOString()
              };
            })}
          />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
