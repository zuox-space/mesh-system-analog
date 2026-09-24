// src/app/dashboard/layout.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DashboardShell } from "./DashboardShell";

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
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  );
}