"use client";

import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function TokenStatusCard({ token }: {
  token: { isActive: boolean; expiresAt: Date | null; grantedAt: Date } | null;
}) {
  if (!token) {
    return (
      <Card>
        <CardTitle>Токен доступа</CardTitle>
        <p className="text-slate-400 text-sm">Токен не предоставлен.</p>
        <p className="text-slate-500 text-xs mt-2">
          Установите расширение и нажмите «Разрешить доступ» на school.mos.ru.
        </p>
      </Card>
    );
  }

  const valid = token.expiresAt ? token.expiresAt > new Date() : true;
  const expStr = token.expiresAt ? token.expiresAt.toLocaleString("ru-RU") : "—";

  return (
    <Card>
      <CardTitle>Токен доступа</CardTitle>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Статус</span>
          <Badge color={valid ? "green" : "red"}>{valid ? "Активен" : "Истёк"}</Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Выдан</span>
          <span className="text-slate-200">{token.grantedAt.toLocaleString("ru-RU")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Истекает</span>
          <span className="text-slate-200">{expStr}</span>
        </div>
      </div>
    </Card>
  );
}