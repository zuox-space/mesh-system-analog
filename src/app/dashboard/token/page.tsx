import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function TokenPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const tokens = await prisma.token.findMany({
    where: { userId: user.id },
    orderBy: { grantedAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-4 max-full">
      <Card>
        <CardTitle>История токенов</CardTitle>
        <div className="space-y-2 text-sm">
          {tokens.length === 0 && <div className="text-slate-400">Пока нет токенов</div>}
          {tokens.map((t) => {
            const valid = t.isActive && (!t.expiresAt || t.expiresAt > new Date());
            return (
              <div key={t.id} className="flex items-center justify-between border border-blue-500/10 rounded-lg px-3 py-2">
                <div className="text-xs text-slate-400">
                  {t.grantedAt.toLocaleString("ru-RU")}
                </div>
                <div className="text-xs text-slate-400">
                  до {t.expiresAt ? t.expiresAt.toLocaleString("ru-RU") : "—"}
                </div>
                <Badge color={valid ? "green" : "gray"}>{valid ? "Активен" : "Неактивен"}</Badge>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Как обновить токен</CardTitle>
        <ol className="text-sm text-slate-300 list-decimal list-inside space-y-1">
          <li>Откройте school.mos.ru и авторизуйтесь.</li>
          <li>Кликните иконку расширения в браузере.</li>
          <li>Нажмите «Разрешить доступ».</li>
          <li>Токен обновится автоматически.</li>
        </ol>
      </Card>
    </div>
  );
}