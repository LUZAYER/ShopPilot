import { requireBusiness } from "@/lib/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/utils";
import { Package, AlertTriangle, TrendingDown, Boxes } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/empty-state";

export default async function ProductsPage() {
  const { businessId } = await requireBusiness();
  const products = await db.product.findMany({
    where: { businessId, active: true },
    orderBy: { createdAt: "desc" }
  });

  const lowStock = products.filter((p) => p.stock <= p.lowStockAt);
  const outOfStock = products.filter((p) => p.stock <= 0);
  const totalValue = products.reduce((s, p) => s + p.cost * p.stock, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-muted-foreground">পণ্য তালিকা ও স্টক ব্যবস্থাপনা</p>
        </div>
        <Badge variant="outline">{products.length} products</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total products</p>
                <p className="text-2xl font-bold mt-1">{products.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Low stock</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">{lowStock.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Out of stock</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{outOfStock.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Stock value</p>
                <p className="text-2xl font-bold mt-1">{formatBDT(totalValue)}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Boxes className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4" /> Low stock alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-900">
              {lowStock.length} product(s) at or below reorder threshold. {outOfStock.length} out of stock.
            </p>
          </CardContent>
        </Card>
      )}

{products.length === 0 ? (
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title="No products yet"
            body="Add your first product from the API or seed script to start tracking inventory and orders."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
    </div>
  );
}
