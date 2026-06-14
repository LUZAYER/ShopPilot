import { requireBusiness } from "@/lib/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileText, Megaphone, Languages } from "lucide-react";
import { ContentStudio } from "@/components/content-studio";

export default async function ContentPage() {
  const { businessId } = await requireBusiness();
  const products = await db.product.findMany({
    where: { businessId, active: true },
    select: { id: true, name: true, category: true },
    take: 50
  });
  const recent = await db.contentPost.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Content Studio</h1>
        <p className="text-sm text-muted-foreground">
          কন্টেন্ট তৈরি করুন — পণ্যের বর্ণনা, ফেসবুক পোস্ট, ক্যাম্পেইন
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium">Product descriptions</p>
                <p className="text-xs text-muted-foreground mt-0.5">SEO-ready descriptions in Bangla & English</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shrink-0">
                <Megaphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium">Facebook posts</p>
                <p className="text-xs text-muted-foreground mt-0.5">Engaging posts with hashtags</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium">Campaigns</p>
                <p className="text-xs text-muted-foreground mt-0.5">Multi-channel campaign strategy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ContentStudio products={products} />

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent content</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {recent.map((c) => (
              <div key={c.id} className="py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{c.type}</Badge>
                  {c.platform && <Badge variant="secondary" className="text-[10px]">{c.platform}</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm mt-2 line-clamp-2">{c.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
