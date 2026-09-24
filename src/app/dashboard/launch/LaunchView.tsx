// src/app/dashboard/launch/LaunchView.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type PlannedLesson = {
  id: number;
  date: string;
  time: string;
  startAt: string;
  groupId: number;
  groupName: string;
  subjectId: number;
  subjectName: string;
  lessonName: string;
  lessonTemplateId: number | null;
  launchUrl: string;
  status: string;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

type PlanState = {
  active: boolean;
  planId: number | null;
  stats?: {
    total: number;
    pending: number;
    running: number;
    finished: number;
    failed: number;
  };
  lessons: PlannedLesson[];
};

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yearRange() {
  const y = new Date().getFullYear();
  return { from: `${y}-09-01`, to: `${y + 1}-08-31` };
}

export function LaunchView() {
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPlan() {
    try {
      const r = await fetch("/api/schedule/plan", { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        setPlan({
          active: !!data.active,
          planId: data.planId ?? null,
          stats: data.stats,
          lessons: data.lessons || [],
        });
      } else {
        setPlan({ active: false, planId: null, lessons: [] });
      }
    } catch (e) {
      console.warn("[launch] не удалось загрузить план:", e);
      setPlan({ active: false, planId: null, lessons: [] });
    } finally {
      setLoaded(true);
    }
  }

  // Создать/обновить план (POST пересоздаёт уроки, isActive = false)
  async function upsertPlan() {
    if (plan?.active) {
      if (
        !confirm(
          "Обновление остановит план. После обновления его нужно будет запустить заново. Продолжить?"
        )
      )
        return;
    }

    setBusy(true);
    setError(null);
    try {
      const { from, to } = yearRange();
      const r = await fetch("/api/schedule/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError("Ошибка: " + (data.detail || "неизвестно"));
      }
      await loadPlan();
    } catch (e: any) {
      setError("Ошибка: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  // Запустить план (isActive = true)
  async function activatePlan() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/schedule/plan/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError("Ошибка запуска: " + (data.detail || "неизвестно"));
      }
      await loadPlan();
    } catch (e: any) {
      setError("Ошибка: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  // Остановить план (isActive = false)
  async function deactivatePlan() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/schedule/plan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError("Ошибка остановки: " + (data.detail || "неизвестно"));
      }
      await loadPlan();
    } catch (e: any) {
      setError("Ошибка: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  // Полностью удалить план (план + все уроки)
  async function purgePlan() {
    if (
      !confirm(
        "Удалить план полностью? Все уроки будут потеряны безвозвратно."
      )
    )
      return;

    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/schedule/plan/purge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError("Ошибка удаления: " + (data.detail || "неизвестно"));
      }
      await loadPlan();
    } catch (e: any) {
      setError("Ошибка: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadPlan();
  }, []);

  if (!loaded) {
    return (
      <Card className="w-full">
        <div className="flex items-center justify-center py-10 gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-slate-500">Загрузка плана…</span>
        </div>
      </Card>
    );
  }

  const hasPlan = !!plan?.planId;

  // ============ Нет плана ============
  if (!hasPlan) {
    return (
      <Card className="w-full">
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-slate-500 text-[13px]">План ещё не создан</p>
          <Button
            size="lg"
            variant="primary"
            onClick={upsertPlan}
            disabled={busy}
          >
            {busy ? "Создание…" : "Загрузить план запуска уроков"}
          </Button>
          {error && (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5 text-[12px]">
              {error}
            </div>
          )}
        </div>
      </Card>
    );
  }

  // ============ План есть ============
  const isActive = !!plan?.active;
  const hasLessons = plan!.lessons.length > 0;

  return (
    <div className="space-y-3 w-full">
      <Card className="w-full !py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              size="md"
              variant="primary"
              onClick={upsertPlan}
              disabled={busy}
            >
              {busy ? "Обновление…" : "Обновить план"}
            </Button>

            {!isActive && (
              <Button
                size="md"
                variant="primary"
                onClick={activatePlan}
                disabled={busy}
                className="!bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600"
              >
                ▶ Автозапуск уроков
              </Button>
            )}

            {isActive && (
              <>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Уроки запускаются
                </span>
                <Button
                  size="md"
                  variant="secondary"
                  onClick={deactivatePlan}
                  disabled={busy}
                >
                  ■ Остановить
                </Button>
              </>
            )}

            {busy && (
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {plan?.stats && (
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-emerald-600">✓ {plan.stats.finished}</span>
                {plan.stats.running > 0 && (
                  <span className="text-blue-600">⚙ {plan.stats.running}</span>
                )}
                {plan.stats.pending > 0 && (
                  <span className="text-slate-400">⏳ {plan.stats.pending}</span>
                )}
                {plan.stats.failed > 0 && (
                  <span className="text-red-600">✕ {plan.stats.failed}</span>
                )}
                <span className="text-slate-500">
                  всего: <b className="text-slate-700">{plan.stats.total}</b>
                </span>
              </div>
            )}

            <Button
              size="sm"
              variant="secondary"
              onClick={purgePlan}
              disabled={busy}
              className="!text-red-600 !border-red-200 hover:!bg-red-50"
            >
              Удалить план
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-2 text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1 text-[12px]">
            {error}
          </div>
        )}
      </Card>

      {hasLessons ? (
        <PlanCalendar lessons={plan!.lessons} />
      ) : (
        <Card className="w-full">
          <p className="text-slate-400 text-[13px] text-center py-8">
            План создан, но уроков нет. Нажмите «Обновить план».
          </p>
        </Card>
      )}
    </div>
  );
}

/* ============ КАЛЕНДАРЬ ПЛАНА ============ */

type WeekGroup = {
  label: string;
  days: { date: string; lessons: PlannedLesson[] }[];
};

type PeriodGroup = {
  label: string;
  from: string;
  to: string;
  weeks: WeekGroup[];
  stats: {
    total: number;
    finished: number;
    failed: number;
    pending: number;
  };
};

function PlanCalendar({ lessons }: { lessons: PlannedLesson[] }) {
  const today = isoToday();
  const now = useMemo(() => new Date(), []);

  const periods = useMemo<PeriodGroup[]>(() => {
    if (lessons.length === 0) return [];

    const byDate = new Map<string, PlannedLesson[]>();
    for (const l of lessons) {
      if (!byDate.has(l.date)) byDate.set(l.date, []);
      byDate.get(l.date)!.push(l);
    }
    for (const arr of byDate.values()) {
      arr.sort((a, b) => a.time.localeCompare(b.time));
    }

    const dates = [...byDate.keys()].sort();
    const first = dates[0];
    const last = dates[dates.length - 1];

    const periodsList: PeriodGroup[] = [];
    let cur = parseDate(first);
    const end = parseDate(last);

    while (cur <= end) {
      const day = cur.getDate();
      let periodStart: Date;
      let periodEnd: Date;

      if (day >= 16) {
        periodStart = new Date(cur.getFullYear(), cur.getMonth(), 16);
        periodEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 15);
      } else {
        periodStart = new Date(cur.getFullYear(), cur.getMonth() - 1, 16);
        periodEnd = new Date(cur.getFullYear(), cur.getMonth(), 15);
      }

      // Собираем даты периода с уроками
      const periodDates: string[] = [];
      const curIter = new Date(periodStart);
      while (curIter <= periodEnd) {
        const iso = isoOf(curIter);
        if (byDate.has(iso)) periodDates.push(iso);
        curIter.setDate(curIter.getDate() + 1);
      }

      if (periodDates.length > 0) {
        // Группируем по неделям (пн–вс)
        const weeks: WeekGroup[] = [];
        let currentWeekDays: { date: string; lessons: PlannedLesson[] }[] = [];
        let lastMonday = "";

        for (const date of periodDates) {
          const d = parseDate(date);
          const dow = d.getDay();
          const diffToMon = dow === 0 ? -6 : 1 - dow;
          const monday = new Date(d);
          monday.setDate(d.getDate() + diffToMon);
          const mondayIso = isoOf(monday);

          if (lastMonday && mondayIso !== lastMonday) {
            if (currentWeekDays.length > 0) {
              weeks.push(makeWeek(currentWeekDays));
            }
            currentWeekDays = [];
          }

          lastMonday = mondayIso;
          currentWeekDays.push({
            date,
            lessons: byDate.get(date) || [],
          });
        }

        if (currentWeekDays.length > 0) {
          weeks.push(makeWeek(currentWeekDays));
        }

        const allPeriodLessons = periodDates.flatMap(
          (d) => byDate.get(d) || []
        );

        periodsList.push({
          label: `${formatRu(periodStart)} — ${formatRu(periodEnd)}`,
          from: isoOf(periodStart),
          to: isoOf(periodEnd),
          weeks,
          stats: {
            total: allPeriodLessons.length,
            finished: allPeriodLessons.filter((l) => l.status === "finished")
              .length,
            failed: allPeriodLessons.filter((l) => l.status === "failed").length,
            pending: allPeriodLessons.filter((l) => l.status === "pending")
              .length,
          },
        });
      }

      cur = new Date(periodEnd);
      cur.setDate(cur.getDate() + 1);
    }

    return periodsList;
  }, [lessons]);

  if (periods.length === 0) {
    return (
      <Card className="w-full">
        <p className="text-slate-400 text-[13px] text-center py-8">
          Нет уроков в плане.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3 w-full">
      {periods.map((p) => (
        <PeriodBlock key={p.from} period={p} today={today} now={now} />
      ))}
    </div>
  );
}

function makeWeek(
  days: { date: string; lessons: PlannedLesson[] }[]
): WeekGroup {
  const wkStart = parseDate(days[0].date);
  const wd = wkStart.getDay();
  const wDiff = wd === 0 ? -6 : 1 - wd;
  const wkMon = new Date(wkStart);
  wkMon.setDate(wkStart.getDate() + wDiff);
  const wkSun = new Date(wkMon);
  wkSun.setDate(wkMon.getDate() + 6);
  return {
    label: `${formatShort(wkMon)} – ${formatShort(wkSun)}`,
    days,
  };
}

function PeriodBlock({
  period,
  today,
  now,
}: {
  period: PeriodGroup;
  today: string;
  now: Date;
}) {
  const progressPct =
    period.stats.total > 0
      ? Math.round((period.stats.finished / period.stats.total) * 100)
      : 0;

  return (
    <Card className="w-full !py-3">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div>
          <div className="text-[13px] font-semibold text-slate-800">
            {period.label}
          </div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
            отчётный период
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-emerald-600">✓ {period.stats.finished}</span>
          {period.stats.pending > 0 && (
            <span className="text-amber-600">⏳ {period.stats.pending}</span>
          )}
          {period.stats.failed > 0 && (
            <span className="text-red-600">✕ {period.stats.failed}</span>
          )}
          <span className="text-slate-500">
            {period.stats.finished} / {period.stats.total}
          </span>
        </div>
      </div>

      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex flex-row gap-3 overflow-x-auto pb-1">
        {period.weeks.map((week, wi) => (
          <WeekColumn key={wi} week={week} today={today} now={now} />
        ))}
      </div>
    </Card>
  );
}

function WeekColumn({
  week,
  today,
  now,
}: {
  week: WeekGroup;
  today: string;
  now: Date;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[180px] shrink-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium pb-1 border-b border-slate-100">
        {week.label}
      </div>

      <div className="flex flex-col gap-0.5">
        {week.days.map(({ date, lessons }) => (
          <DayRow
            key={date}
            date={date}
            lessons={lessons}
            today={today}
            now={now}
          />
        ))}
      </div>
    </div>
  );
}

function DayRow({
  date,
  lessons,
  today,
  now,
}: {
  date: string;
  lessons: PlannedLesson[];
  today: string;
  now: Date;
}) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const isToday = date === today;
  const isPast = date < today;

  const weekdayShort = dt.toLocaleDateString("ru-RU", { weekday: "short" });

  return (
    <div
      className={`flex items-center gap-2 px-1.5 py-1 rounded-md ${isToday
        ? "bg-blue-50 border border-blue-200"
        : isPast
          ? "bg-slate-50/50"
          : "bg-white"
        }`}
    >
      <div className="flex items-baseline gap-1 w-14 shrink-0">
        <span
          className={`text-[11px] font-mono font-semibold ${isToday ? "text-blue-700" : "text-slate-600"
            }`}
        >
          {String(d).padStart(2, "0")}.{String(m).padStart(2, "0")}
        </span>
        <span className="text-[9px] text-slate-400 uppercase">
          {weekdayShort}
        </span>
      </div>

      <div className="flex-1 flex flex-wrap gap-1">
        {lessons.map((l) => (
          <LessonSquare key={l.id} lesson={l} now={now} />
        ))}
      </div>
    </div>
  );
}

function LessonSquare({
  lesson,
  now,
}: {
  lesson: PlannedLesson;
  now: Date;
}) {
  let colorClass = "";
  let tooltip = "";

  const startAt = new Date(lesson.startAt);
  const isFuture = startAt > now;
  const hasUrl = !!lesson.launchUrl;

  if (lesson.status === "finished") {
    colorClass = "bg-emerald-500 border-emerald-600 hover:bg-emerald-600";
    tooltip = `${lesson.time} — проведён`;
  } else if (lesson.status === "running") {
    colorClass = "bg-blue-500 border-blue-600 hover:bg-blue-600";
    tooltip = `${lesson.time} — идёт сейчас`;
  } else if (lesson.status === "failed") {
    colorClass = "bg-red-500 border-red-600 hover:bg-red-600";
    tooltip = `${lesson.time} — ошибка`;
  } else {
    if (isFuture) {
      colorClass = "bg-amber-400 border-amber-500 hover:bg-amber-500";
      tooltip = `${lesson.time} — ожидает запуска`;
    } else {
      colorClass = "bg-red-500 border-red-600 hover:bg-red-600";
      tooltip = `${lesson.time} — не запущен`;
    }
  }

  if (!hasUrl) {
    colorClass = "bg-slate-200 border-slate-300";
    tooltip = `${lesson.time} — нет ссылки на запуск`;
  }

  function handleClick() {
    if (!hasUrl) return;
    window.open(lesson.launchUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      title={tooltip}
      onClick={handleClick}
      className={`w-6 h-6 rounded-sm border transition ${colorClass} ${hasUrl ? "cursor-pointer hover:scale-110" : "cursor-not-allowed"
        }`}
    />
  );
}

/* ============ Утилиты ============ */

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatRu(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatShort(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}