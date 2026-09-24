// src/app/dashboard/launch/LaunchView.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Lesson = {
  id: number;
  date: string;
  time: string;
  study_ordinal: number;
  lesson_name: string;
  topic_name: string;
  group_id: number;
  group_name: string;
  class_unit_name: string;
  subject_id: number;
  subject_name: string;
  room_name: string;
  script_uuid: string | null;
  script_uuid_original: string | null;
};

type DayBucket = {
  key: string;
  weekday: string;
  dayNumber: string;
  month: string;
  isToday: boolean;
  isTomorrow: boolean;
  isPast: boolean;
  lessons: Lesson[];
};

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildDayBucket(
  key: string,
  lessons: Lesson[],
  todayIso: string,
  tomorrowIso: string
): DayBucket {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  const weekdayShort = date.toLocaleDateString("ru-RU", { weekday: "short" });
  const weekday = weekdayShort.charAt(0).toUpperCase() + weekdayShort.slice(1);

  return {
    key,
    weekday,
    dayNumber: String(d).padStart(2, "0"),
    month: date.toLocaleDateString("ru-RU", { month: "long" }),
    isToday: key === todayIso,
    isTomorrow: key === tomorrowIso,
    isPast: key < todayIso,
    lessons,
  };
}

/**
 * Формирует URL для запуска сценария.
 * activity_url = https://uchebnik.mos.ru/cms/materials/{uuid}/launch?teacher_id=...&subject_id=...&group_id=...&mode=management
 * Финальная ссылка: school.mos.ru/api/launcher/v1/launch?activity_url={URL_ENCODED}
 */
function buildLaunchUrl(
  scriptUuid: string,
  teacherId: number,
  subjectId: number,
  groupId: number
): string {
  const activityUrl = `https://uchebnik.mos.ru/cms/materials/${scriptUuid}/launch?teacher_id=${teacherId}&subject_id=${subjectId}&group_id=${groupId}&mode=management`;
  return `https://school.mos.ru/api/launcher/v1/launch?activity_url=${encodeURIComponent(
    activityUrl
  )}`;
}

function shortLessonName(name: string): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  const first = words[0] || "";
  return first.length > 16 ? first.slice(0, 15) + "…" : first;
}

export function LaunchView() {
  const [dateFrom, setDateFrom] = useState(isoToday());
  const [dateTo, setDateTo] = useState(isoPlusDays(7));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayIso = isoToday();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/launch/lessons?from=${dateFrom}&to=${dateTo}`,
        { cache: "no-store" }
      );
      const data = await r.json();
      if (!r.ok) {
        setError(data.detail || "Ошибка загрузки");
        return;
      }
      setLessons(data.lessons || []);
      setTeacherId(data.teacherId || null);
      setHasLoadedOnce(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [dateFrom, dateTo]);

  const days: DayBucket[] = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const l of lessons) {
      if (!l.date) continue;
      if (!map.has(l.date)) map.set(l.date, []);
      map.get(l.date)!.push(l);
    }

    const tomorrowIso = isoPlusDays(1);

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, arr]) =>
        buildDayBucket(
          key,
          arr.sort((a, b) => (a.time || "").localeCompare(b.time || "")),
          todayIso,
          tomorrowIso
        )
      );
  }, [lessons, todayIso]);

  const futureDays = days.filter((d) => !d.isPast);
  const pastDays = days.filter((d) => d.isPast);

  return (
    <div className="space-y-3 w-full">
      {/* ============ Пульт ============ */}
      <Card className="w-full !py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <QuickBtn
              active={dateFrom === isoToday() && dateTo === isoPlusDays(7)}
              onClick={() => {
                setDateFrom(isoToday());
                setDateTo(isoPlusDays(7));
              }}
            >
              7д
            </QuickBtn>
            <QuickBtn
              active={dateFrom === isoToday() && dateTo === isoToday()}
              onClick={() => {
                setDateFrom(isoToday());
                setDateTo(isoToday());
              }}
            >
              Сегодня
            </QuickBtn>
            <QuickBtn
              active={dateFrom === isoToday() && dateTo === isoPlusDays(14)}
              onClick={() => {
                setDateFrom(isoToday());
                setDateTo(isoPlusDays(14));
              }}
            >
              14д
            </QuickBtn>
            <QuickBtn
              active={dateFrom === isoToday() && dateTo === isoPlusDays(30)}
              onClick={() => {
                setDateFrom(isoToday());
                setDateTo(isoPlusDays(30));
              }}
            >
              30д
            </QuickBtn>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400">с</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px]"
            />
            <span className="text-slate-400">по</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px]"
            />
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={load}
            disabled={loading}
          >
            {loading ? "..." : "Обновить"}
          </Button>
          {loading && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>Загружаю...</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-2 text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1 text-[12px]">
            {error}
          </div>
        )}
      </Card>

      {/* ============ Скелетоны ============ */}
      {loading && !hasLoadedOnce && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 w-full items-start">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ============ Будущие дни ============ */}
      {hasLoadedOnce && (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 w-full items-start transition-opacity ${
            loading ? "opacity-50 pointer-events-none" : "opacity-100"
          }`}
        >
          {futureDays.map((d) => (
            <DayCard key={d.key} day={d} teacherId={teacherId} />
          ))}
        </div>
      )}

      {/* ============ Прошедшие ============ */}
      {hasLoadedOnce && pastDays.length > 0 && (
        <PastDays days={pastDays} teacherId={teacherId} />
      )}

      {hasLoadedOnce && days.length === 0 && !loading && !error && (
        <Card className="w-full">
          <p className="text-slate-400 text-[13px] text-center py-6">
            Уроков за период нет.
          </p>
        </Card>
      )}
    </div>
  );
}

/* ============ Кнопка периода ============ */

function QuickBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded-md text-[11px] font-medium border transition ${
        active
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ============ Скелетон ============ */

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden animate-pulse">
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
        <div className="flex items-baseline justify-between gap-2">
          <div className="h-5 w-14 bg-slate-200 rounded" />
          <div className="h-3 w-12 bg-slate-100 rounded" />
        </div>
      </div>
      <div className="flex-1 p-1.5 space-y-1">
        <div className="rounded-md border border-slate-100 bg-slate-50/60 p-2 space-y-1">
          <div className="h-3 w-3/4 bg-slate-200 rounded" />
          <div className="h-2.5 w-full bg-slate-100 rounded" />
        </div>
      </div>
    </div>
  );
}

/* ============ Карточка дня ============ */

function DayCard({
  day,
  teacherId,
}: {
  day: DayBucket;
  teacherId: number | null;
}) {
  const accent = day.isToday
    ? "border-blue-300 shadow-blue-200/50"
    : day.isTomorrow
    ? "border-violet-200"
    : day.isPast
    ? "border-slate-200 opacity-70"
    : "border-slate-200";

  const withScript = day.lessons.filter((l) => l.script_uuid).length;

  return (
    <div
      className={`rounded-lg border bg-white shadow-sm ${accent} flex flex-col overflow-hidden`}
    >
      <div
        className={`px-3 py-2 border-b ${
          day.isToday
            ? "bg-gradient-to-r from-blue-50 to-violet-50 border-blue-100"
            : "bg-slate-50 border-slate-100"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-[20px] font-bold leading-none ${
                day.isToday ? "text-blue-700" : "text-slate-800"
              }`}
            >
              {day.dayNumber}
            </span>
            <span className="text-[11px] text-slate-500 uppercase tracking-wide">
              {day.weekday}
            </span>
          </div>
          <div className="text-[10px] text-slate-500">{day.month}</div>
        </div>
        {withScript > 0 && (
          <div className="text-[10px] text-blue-600 font-medium mt-1">
            со сценарием: {withScript}
          </div>
        )}
      </div>

      <div className="flex-1 p-1.5 space-y-1">
        {day.lessons.length === 0 && (
          <div className="text-[12px] text-slate-400 text-center py-6 flex flex-col items-center gap-1">
            <span className="text-[16px]">🎉</span>
            <span>Уроков нет</span>
          </div>
        )}

        {day.lessons.map((l, i) => (
          <LessonRow
            key={i}
            lesson={l}
            today={day.isToday}
            past={day.isPast}
            teacherId={teacherId}
          />
        ))}
      </div>
    </div>
  );
}

/* ============ Строка урока ============ */

function LessonRow({
  lesson,
  today,
  past,
  teacherId,
}: {
  lesson: Lesson;
  today: boolean;
  past: boolean;
  teacherId: number | null;
}) {
  const canLaunch =
    !past && lesson.script_uuid && teacherId && lesson.group_id && lesson.subject_id;

  const launchUrl = canLaunch
    ? buildLaunchUrl(
        lesson.script_uuid!,
        teacherId!,
        lesson.subject_id,
        lesson.group_id
      )
    : null;

  return (
    <div
      className={`rounded-md border transition ${
        past
          ? "bg-slate-50/60 border-slate-100"
          : lesson.script_uuid
          ? "bg-blue-50/40 border-blue-100"
          : "bg-slate-50/60 border-slate-100"
      }`}
    >
      <div className="flex items-center gap-2 px-2 pt-1.5">
        <span
          className={`font-mono text-[10px] shrink-0 ${
            today ? "text-blue-700 font-semibold" : "text-slate-500"
          }`}
        >
          {lesson.time || "—"}
        </span>
        <span className="flex-1 text-[11px] font-medium text-slate-800 truncate">
          {shortLessonName(lesson.group_name || lesson.class_unit_name) ||
            lesson.group_name ||
            "—"}
        </span>
      </div>

      <div className="px-2 pb-1.5">
        {lesson.script_uuid ? (
          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
            {lesson.topic_name || lesson.lesson_name || "Сценарий урока"}
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 italic mt-0.5">
            сценарий не прикреплён
          </div>
        )}
      </div>

      {!past && (
        <div className="px-2 pb-1.5 flex justify-end">
          {launchUrl ? (
            <a
              href={launchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold hover:underline whitespace-nowrap"
            >
              ▶ Запустить урок
            </a>
          ) : (
            <span className="text-[10px] text-slate-400 italic">
              нет сценария
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ============ Прошедшие дни ============ */

function PastDays({
  days,
  teacherId,
}: {
  days: DayBucket[];
  teacherId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const total = days.reduce((acc, d) => acc + d.lessons.length, 0);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-1 mb-1 text-[13px] font-semibold text-slate-400 hover:text-slate-600"
      >
        <span className="text-[10px]">{open ? "▾" : "▸"}</span>
        <span>Прошедшие ({total})</span>
      </button>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 w-full items-start">
          {days.map((d) => (
            <DayCard key={d.key} day={d} teacherId={teacherId} />
          ))}
        </div>
      )}
    </div>
  );
}