import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Table, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    include: {
      tokens: {
        where: { isActive: true },
        orderBy: { grantedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  function statusBadge(status: string) {
    if (status === "ACTIVE") return <Badge color="green">активен</Badge>;
    if (status === "PENDING") return <Badge color="blue">ожидает</Badge>;
    if (status === "BLOCKED") return <Badge color="red">заблокирован</Badge>;
    return <Badge color="gray">{status}</Badge>;
  }

  return (
    <Card className="w-full">
      <CardTitle>Пользователи ({users.length})</CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>ФИО</Th>
            <Th>Email</Th>
            <Th>Роль</Th>
            <Th>Доступ</Th>
            <Th>Токен</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const t = u.tokens[0];
            const valid = t && (!t.expiresAt || t.expiresAt > new Date());
            return (
              <tr key={u.id}>
                <Td>
                  {[u.lastName, u.firstName, u.middleName]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </Td>
                <Td className="text-slate-500">{u.email || "—"}</Td>
                <Td>
                  <Badge color={u.role === "ADMIN" ? "blue" : "gray"}>
                    {u.role}
                  </Badge>
                </Td>
                <Td>{statusBadge(u.accessStatus)}</Td>
                <Td>
                  <Badge color={valid ? "green" : "gray"}>
                    {valid ? "активен" : "нет"}
                  </Badge>
                </Td>
                <Td>
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-blue-600 hover:underline text-[12px]"
                  >
                    Открыть
                  </Link>
                </Td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <Td className="text-slate-400">Пользователей нет</Td>
              <Td></Td>
              <Td></Td>
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