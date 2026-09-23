import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { TokenStatusCard } from "@/components/TokenStatusCard";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Обычного пользователя редиректим на «Токен»
  if (user.role !== "ADMIN") {
    redirect("/dashboard/token");
  }

  // Дальше — только для админа
  const token = await prisma.token.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { grantedAt: "desc" },
  });

  return (
    <div className="space-y-3 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
        <Card className="w-full">
          <CardTitle>Профиль</CardTitle>
          <div className="space-y-0.5 text-[13px]">
            <div className="text-slate-900 text-[14px] font-medium">
              {[user.lastName, user.firstName, user.middleName]
                .filter(Boolean)
                .join(" ") || "Пользователь"}
            </div>
            <div className="text-slate-500">{user.email || "Email не указан"}</div>
            <div className="text-slate-400 text-[10px] font-mono">
              sub: {user.sub}
            </div>
          </div>
        </Card>

        <TokenStatusCard token={token} />
      </div>
    </div>
  );
}