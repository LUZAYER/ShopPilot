import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentBusiness } from "@/lib/session";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const business = await getCurrentBusiness();
  if (!business) redirect("/login");

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar role={user.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={{ name: user.name, email: user.email }} businessName={business.name} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
