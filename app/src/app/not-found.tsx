import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

/**
 * 404 page — Phase 12 UX edge case.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <Compass className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Page not found</h1>
        <p className="text-sm text-slate-600 mb-6">
          The page you are looking for has moved or never existed.
        </p>
        <Link href="/dashboard">
          <Button variant="default">Go to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
