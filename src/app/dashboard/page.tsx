import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";

export default async function AdminHome() {
  const [users, tokens, activeTokens, logs, pending] = await Promise.all([
    prisma.user.count(),
    prisma.token.count(),
    prisma.token.count({ where: { isActive: true } }),
    prisma.logEntry.count(),
    prisma.user.count({ where: { accessStatus: "PENDING" } }),
  ]);

  const stats = [
    { label: "Пользователей", value: users },
    { label: "Всего токенов", value: tokens },
    { label: "Активных токенов", value: activeTokens },
    { label: "Ожидают активации", value: pending },
    { label: "Записей в логе", value: logs },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
      {stats.map((s) => (
        <Card key={s.label}>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-semibold">
            {s.label}
          </div>
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            {s.value}
          </div>
        </Card>
      ))}
    </div>
  );
}