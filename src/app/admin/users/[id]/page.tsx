import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { UserControls } from "./UserControls";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number(id);
  if (!userId) notFound();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tokens: { orderBy: { grantedAt: "desc" }, take: 50 },
      logs: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!user) notFound();

  return (
    <div className="space-y-3 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
        <Card>
          <CardTitle>Профиль</CardTitle>
          <div className="space-y-0.5">
            <div className="text-slate-900 text-[14px] font-medium">
              {[user.lastName, user.firstName, user.middleName]
                .filter(Boolean)
                .join(" ") || "—"}
            </div>
            <div className="text-slate-500 text-[12px]">{user.email || "—"}</div>
            <div className="text-slate-400 text-[10px] font-mono">
              sub: {user.sub}
            </div>
          </div>
        </Card>

        <UserControls
          userId={user.id}
          initialRole={user.role}
          initialAccessStatus={user.accessStatus}
        />
      </div>

      <Card className="w-full">
        <CardTitle>Токены</CardTitle>
        <Table>
          <thead>
            <tr>
              <Th>Выдан</Th>
              <Th>Истекает</Th>
              <Th>Статус</Th>
            </tr>
          </thead>
          <tbody>
            {user.tokens.map((t) => {
              const valid =
                t.isActive && (!t.expiresAt || t.expiresAt > new Date());
              return (
                <tr key={t.id}>
                  <Td>{t.grantedAt.toLocaleString("ru-RU")}</Td>
                  <Td>
                    {t.expiresAt ? t.expiresAt.toLocaleString("ru-RU") : "—"}
                  </Td>
                  <Td>
                    <Badge color={valid ? "green" : "gray"}>
                      {valid ? "активен" : "неактивен"}
                    </Badge>
                  </Td>
                </tr>
              );
            })}
            {user.tokens.length === 0 && (
              <tr>
                <Td className="text-slate-400">Нет токенов</Td>
                <Td></Td>
                <Td></Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Card className="w-full">
        <CardTitle>Журнал</CardTitle>
        <Table>
          <thead>
            <tr>
              <Th>Дата</Th>
              <Th>Действие</Th>
              <Th>Детали</Th>
            </tr>
          </thead>
          <tbody>
            {user.logs.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap">
                  {l.createdAt.toLocaleString("ru-RU")}
                </Td>
                <Td>{l.action}</Td>
                <Td className="text-[11px] text-slate-500">
                  {l.details || "—"}
                </Td>
              </tr>
            ))}
            {user.logs.length === 0 && (
              <tr>
                <Td className="text-slate-400">Пусто</Td>
                <Td></Td>
                <Td></Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}