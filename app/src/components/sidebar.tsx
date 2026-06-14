"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Inbox, ShoppingCart, Package, Users, Network,
  Sparkles, Bot, Settings, LogOut, Film
} from "lucide-react";
type Role = "OWNER" | "STAFF" | "RESELLER";

const nav = [
  { href: "/dashboard", label: "Dashboard", labelBn: "ড্যাশবোর্ড", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", labelBn: "ইনবক্স", icon: Inbox },
  { href: "/orders", label: "Orders", labelBn: "অর্ডার", icon: ShoppingCart },
  { href: "/products", label: "Inventory", labelBn: "ইনভেন্টরি", icon: Package },
  { href: "/resellers", label: "Resellers", labelBn: "রিসেলার", icon: Network, role: "OWNER" as Role },
  { href: "/content", label: "Content Studio", labelBn: "কন্টেন্ট স্টুডিও", icon: Sparkles },
  { href: "/copilot", label: "Copilot", labelBn: "কো-পাইলট", icon: Bot },
  { href: "/video-studio", label: "Video Studio", labelBn: "ভিডিও স্টুডিও", icon: Film },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <aside className="w-64 bg-white border-r flex flex-col shrink-0">
      <div className="p-5 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">ShopPilot</p>
            <p className="text-[10px] text-muted-foreground -mt-0.5">AI Social Commerce OS</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => {
          if (item.role && item.role !== role) return null;
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-green-50 text-green-700 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100"
        >
          <Settings className="h-4 w-4" /> Settings
        </Link>
        <Link
          href="/api/auth/signout"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Link>
      </div>
    </aside>
  );
}
