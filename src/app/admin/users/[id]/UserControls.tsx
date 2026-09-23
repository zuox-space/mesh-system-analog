"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function UserControls({
  userId,
  initialRole,
  initialAccessStatus,
}: {
  userId: number;
  initialRole: string;
  initialAccessStatus: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState(initialRole);
  const [accessStatus, setAccessStatus] = useState(initialAccessStatus);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, accessStatus }),
    });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) {
      setMsg("Ошибка: " + (data.detail || "неизвестно"));
      return;
    }
    setMsg("Сохранено");
    router.refresh();
  }

  const selectClass =
    "mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px]";

  return (
    <Card className="w-full">
      <CardTitle>Роль и доступ</CardTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Роль
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={selectClass}
          >
            <option value="TEACHER">Учитель</option>
            <option value="ADMIN">Администратор</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Статус доступа
          </label>
          <select
            value={accessStatus}
            onChange={(e) => setAccessStatus(e.target.value)}
            className={selectClass}
          >
            <option value="PENDING">Ожидает</option>
            <option value="ACTIVE">Активен</option>
            <option value="BLOCKED">Заблокирован</option>
          </select>
        </div>

        <div className="flex items-end">
          <Button onClick={save} disabled={saving} size="sm" className="w-full">
            {saving ? "Сохраняю..." : "Сохранить"}
          </Button>
        </div>
      </div>

      {msg && (
        <div
          className={`mt-3 text-[12px] rounded-md px-2.5 py-1.5 border ${
            msg.startsWith("Ошибка")
              ? "text-red-600 bg-red-50 border-red-200"
              : "text-emerald-700 bg-emerald-50 border-emerald-200"
          }`}
        >
          {msg}
        </div>
      )}
    </Card>
  );
}