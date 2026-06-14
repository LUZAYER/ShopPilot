"use client";

import { useState } from "react";
import { Search, Bell, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function Topbar({
  user,
  businessName
}: {
  user: { name: string | null; email: string };
  businessName: string;
}) {
  const [lang, setLang] = useState<"en" | "bn">("en");
  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search orders, products, customers…" className="pl-9 h-9" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className="font-normal">
          {businessName}
        </Badge>

        <button
          onClick={() => setLang(lang === "en" ? "bn" : "en")}
          className="h-9 px-3 rounded-md border flex items-center gap-1.5 text-sm hover:bg-gray-50"
        >
          <Globe className="h-4 w-4" />
          {lang === "en" ? "EN" : "বাং"}
        </button>

        <button className="h-9 w-9 rounded-md border flex items-center justify-center hover:bg-gray-50 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-semibold">
          {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
        </div>
      </div>
    </header>
  );
}
