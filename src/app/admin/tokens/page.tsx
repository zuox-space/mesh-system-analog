import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

export default async function TokensPage() {
  const tokens = await prisma.token.findMany({
    include: { user: true },
    orderBy: { grantedAt: "desc" },
    take: 200,
  });

  return (
    <Card className="w-full">
      <CardTitle>Все токены ({tokens.length})</CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Пользователь</Th>
            <Th>Выдан</Th>
            <Th>Истекает</Th>
            <Th>Статус</Th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => {
            const valid =
              t.isActive && (!t.expiresAt || t.expiresAt > new Date());
            return (
              <tr key={t.id}>
                <Td>
                  {[t.user.lastName, t.user.firstName]
                    .filter(Boolean)
                    .join(" ") || t.user.sub}
                </Td>
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
          {tokens.length === 0 && (
            <tr>
              <Td className="text-slate-400">Токенов нет</Td>
              <Td></Td>
              <Td></Td>
              <Td></Td>
            </tr>
          )}
        </tbody>
      </Table>
    </Card>
  );
}