import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CriteriaView } from "./CriteriaView";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <CriteriaView />;
}