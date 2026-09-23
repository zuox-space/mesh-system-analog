import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.accessStatus === "PENDING") redirect("/pending");
  if (user.accessStatus === "BLOCKED") redirect("/blocked");

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar role={user.role as "TEACHER" | "ADMIN"} />
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <Header title="Личный кабинет" user={user} />
        <main className="flex-1 p-4 overflow-y-auto w-full">{children}</main>
      </div>
    </div>
  );
}