"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBDT } from "@/lib/utils";
import { Package, AlertTriangle } from "lucide-react";

type Product = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  cost: number;
  stock: number;
  lowStockAt: number;
  imageUrl: string | null;
  sku: string | null;
};

export function ProductCard({ product: p }: { product: Product }) {
  const margin = p.cost > 0 ? ((p.price - p.cost) / p.cost) * 100 : 0;
  const isLow = p.stock <= p.lowStockAt;
  const isOut = p.stock <= 0;
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={p.name} className="object-cover w-full h-full" />
        ) : (
          <Package className="h-12 w-12 text-green-600/50" />
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">{p.name}</h3>
            {p.category && (
              <p className="text-xs text-muted-foreground">{p.category}</p>
            )}
          </div>
          {isOut ? (
            <Badge variant="destructive" className="text-[10px]">Out</Badge>
          ) : isLow ? (
            <Badge variant="warning" className="text-[10px]">
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Low
            </Badge>
          ) : (
            <Badge variant="success" className="text-[10px]">{p.stock} in stock</Badge>
          )}
        </div>
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="font-bold">{formatBDT(p.price)}</span>
          <span className="text-xs text-muted-foreground">
            {margin.toFixed(0)}% margin
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
