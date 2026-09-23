import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td } from "@/components/ui/Table";

export default async function LogsPage() {
  const logs = await prisma.logEntry.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <Card className="w-full">
      <CardTitle>Журнал действий ({logs.length})</CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Дата</Th>
            <Th>Пользователь</Th>
            <Th>Действие</Th>
            <Th>Детали</Th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <Td className="whitespace-nowrap">
                {l.createdAt.toLocaleString("ru-RU")}
              </Td>
              <Td>
                {l.user
                  ? [l.user.lastName, l.user.firstName]
                      .filter(Boolean)
                      .join(" ")
                  : "—"}
              </Td>
              <Td>{l.action}</Td>
              <Td className="text-[11px] text-slate-500">{l.details || "—"}</Td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <Td className="text-slate-400">Пусто</Td>
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