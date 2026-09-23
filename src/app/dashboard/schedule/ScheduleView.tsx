// src/app/dashboard/schedule/ScheduleView.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Lesson = {
  date: [number, number, number];
  lesson_name: string;
  room_name: string;
  group_name: string;
  study_ordinal: number;
  time: [number, number, number];
  teacher_name?: string;
  cancelled?: boolean;
  replaced?: boolean;
};

function formatDate(d: [number, number, number]): string {
  const [y, m, day] = d;
  return new Date(y, m - 1, day).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTime(t: [number, number, number]): string {
  const [h, m] = t;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function ScheduleView() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);
      const to = new Date(today.getTime() + 7 * 86400000)
        .toISOString()
        .slice(0, 10);

      const r = await fetch(`/api/schedule?from=${from}&to=${to}`);
      const data = await r.json();

      if (!r.ok) {
        setError(data.detail || "Ошибка загрузки");
        return;
      }

      const items = Array.isArray(data) ? data : data.items || data.data || [];
      setLessons(items);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const byDate = new Map<string, Lesson[]>();
  for (const l of lessons) {
    if (l.cancelled) continue;
    const key = formatDate(l.date);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(l);
  }

  return (
    <div className="space-y-3 w-full">
      <Card className="w-full">
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Расписание на неделю</CardTitle>
          <Button onClick={load} disabled={loading} size="sm" variant="secondary">
            {loading ? "Загружаю..." : "Обновить"}
          </Button>
        </div>

        {error && (
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-[13px] mb-2">
            {error}
          </div>
        )}

        {byDate.size === 0 && !loading && (
          <p className="text-slate-400 text-[13px]">
            Нет уроков на выбранный период.
          </p>
        )}

        <div className="space-y-4">
          {[...byDate.entries()].map(([date, items]) => (
            <div key={date}>
              <div className="text-[12px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                {date}
              </div>
              <div className="space-y-1">
                {items
                  .sort((a, b) => a.study_ordinal - b.study_ordinal)
                  .map((l, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-md border border-slate-200 bg-white text-[13px]"
                    >
                      <div className="w-12 text-slate-500 font-mono">
                        {formatTime(l.time)}
                      </div>
                      <div className="w-8 text-center">
                        <Badge color="gray">{l.study_ordinal}</Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">
                          {l.lesson_name || "—"}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {l.group_name || ""}{" "}
                          {l.room_name ? `• ${l.room_name}` : ""}
                        </div>
                      </div>
                      {l.replaced && <Badge color="red">замена</Badge>}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}