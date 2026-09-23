"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function ExtensionCard({
  initialLinked,
  initialCode,
  initialExpires,
}: {
  initialLinked: boolean;
  initialCode: string | null;
  initialExpires: string | null;
}) {
  const [linked, setLinked] = useState(initialLinked);
  const [code, setCode] = useState<string | null>(initialCode);
  const [expires, setExpires] = useState<string | null>(initialExpires);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Таймер обратного отсчёта
  useEffect(() => {
    if (!expires) {
      setSecondsLeft(0);
      return;
    }
    const update = () => {
      const left = Math.max(0, Math.round((new Date(expires).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expires]);

  async function generate() {
    setLoading(true);
    const r = await fetch("/api/extension/generate-code", { method: "POST" });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) {
      alert("Ошибка: " + (data.detail || "неизвестно"));
      return;
    }
    setCode(data.code);
    setExpires(data.expiresAt);
  }

  async function unlink() {
    if (!confirm("Отвязать расширение? Текущий токен перестанет работать.")) return;
    setLoading(true);
    await fetch("/api/extension/unlink", { method: "POST" });
    setLinked(false);
    setCode(null);
    setExpires(null);
    setLoading(false);
  }

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <Card className="w-full">
      <CardTitle>Расширение браузера</CardTitle>

      {!linked && !code && (
        <>
          <p className="text-[13px] text-slate-600 mb-3">
            Свяжите расширение с вашим аккаунтом. Сгенерируйте код и введите его в окне расширения.
          </p>
          <Button onClick={generate} disabled={loading} size="sm">
            {loading ? "Генерирую..." : "Сгенерировать код"}
          </Button>
        </>
      )}

      {!linked && code && (
        <>
          <p className="text-[13px] text-slate-600 mb-3">
            Введите этот код в окне расширения:
          </p>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl font-mono font-bold tracking-[0.4em] text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-4 py-2">
              {code}
            </div>
            {secondsLeft > 0 ? (
              <div className="text-[12px] text-slate-500">
                действует ещё {mm}:{ss}
              </div>
            ) : (
              <div className="text-[12px] text-red-500">код истёк</div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={generate} disabled={loading} size="sm" variant="secondary">
              Новый код
            </Button>
          </div>
        </>
      )}

      {linked && (
        <>
          <div className="flex items-center gap-3 mb-3">
            <Badge color="green">связано</Badge>
            <span className="text-[13px] text-slate-600">
              Расширение привязано к вашему аккаунту.
            </span>
          </div>
          <Button onClick={unlink} disabled={loading} size="sm" variant="danger">
            Отвязать
          </Button>
        </>
      )}
    </Card>
  );
}