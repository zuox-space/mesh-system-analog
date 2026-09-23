// src/app/dashboard/schedule/ScheduleView.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Lesson = {
  date: [number, number, number];
  lesson_name: string;
  room_name: string;
  room_number?: string;
  room_id?: number;
  room_resolved_name?: string;
  group_name: string;
  study_ordinal: number;
  time: [number, number, number];
  teacher_name?: string;
  cancelled?: boolean;
  replaced?: boolean;
};

type DayGroup = {
  key: string;
  weekday: string;
  dayNumber: string;
  month: string;
  isToday: boolean;
  isTomorrow: boolean;
  lessons: Lesson[];
};

function toISODate(d: [number, number, number]): string {
  const [y, m, day] = d;
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatTime(t: [number, number, number]): string {
  const [h, m] = t;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Первые 2 слова названия урока */
function shortName(name: string): string {
  if (!name) return "—";
  const words = name.trim().split(/\s+/);
  if (words.length <= 2) return name;
  return words.slice(0, 2).join(" ");
}

/**
 * Короткое имя группы для строки урока.
 * Убирает фамилию учителя в конце.
 * Пример: "Информатика 10-А Найдюк" → "Информатика 10-А"
 */
function shortGroupLabel(group: string | undefined): string {
  if (!group) return "—";
  const parts = group.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  if (
    parts.length > 2 &&
    last &&
    /^[А-ЯЁ][а-яё]+$/.test(last) &&
    !/\d/.test(last)
  ) {
    parts.pop();
  }
  return parts.join(" ");
}

/** Короткая метка группы: 8-И, 10-А, 1гр и т.п. */
function shortGroup(group: string | undefined): string {
  if (!group) return "";
  const m = group.match(/\d{1,2}-[А-Яа-яA-Za-z]/);
  if (m) return m[0];
  const words = group.trim().split(/\s+/);
  const last = words[words.length - 1];
  return last && last.length <= 8 ? last : "";
}

/** Возвращает понедельник и субботу недели, в которую попадает offset недель */
function getWeekRange(offset: number): { from: string; to: string; label: string } {
  const now = new Date();

  // День недели: 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
  const dow = now.getDay();

  // Сдвиг до понедельника текущей недели
  const diffToMonday = dow === 0 ? -6 : 1 - dow;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5); // пт = +4, сб = +5

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const dd = (d: Date) => String(d.getDate()).padStart(2, "0");
  const mm = (d: Date) => String(d.getMonth() + 1).padStart(2, "0");

  let label: string;
  if (offset === 0) label = "Эта неделя";
  else if (offset === -1) label = "Прошлая неделя";
  else if (offset === 1) label = "Следующая неделя";
  else label = `Неделя ${dd(monday)}.${mm(monday)}`;

  return {
    from: fmt(monday),
    to: fmt(saturday),
    label: `${label} · ${dd(monday)}.${mm(monday)} – ${dd(saturday)}.${mm(saturday)}`,
  };
}

function buildDayGroup(
  key: string,
  lessons: Lesson[],
  today: string,
  tomorrow: string
): DayGroup {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  const weekdayShort = date.toLocaleDateString("ru-RU", { weekday: "short" });
  const weekday = weekdayShort.charAt(0).toUpperCase() + weekdayShort.slice(1);

  return {
    key,
    weekday,
    dayNumber: String(d).padStart(2, "0"),
    month: date.toLocaleDateString("ru-RU", { month: "long" }),
    isToday: key === today,
    isTomorrow: key === tomorrow,
    lessons,
  };
}

export function ScheduleView() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  async function load(offset = weekOffset) {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getWeekRange(offset);
      const r = await fetch(`/api/schedule?from=${from}&to=${to}`, {
        cache: "no-store",
      });
      const data = await r.json();

      if (!r.ok) {
        setError(data.detail || "Ошибка загрузки");
        return;
      }

      // Сервер возвращает { items, rooms }, но старый формат тоже поддержан
      const items = Array.isArray(data)
        ? data
        : data.items || data.data || [];
      setLessons(items);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(weekOffset);
  }, [weekOffset]);

  const days = useMemo<DayGroup[]>(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const tomorrowISO = new Date(Date.now() + 86400000)
      .toISOString()
      .slice(0, 10);

    // Группируем уроки по датам
    const map = new Map<string, Lesson[]>();
    for (const l of lessons) {
      if (l.cancelled) continue;
      const key = toISODate(l.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }

    // Границы недели: понедельник .. суббота
    const { from } = getWeekRange(weekOffset);
    const [y, m, d] = from.split("-").map(Number);
    const monday = new Date(y, m - 1, d);

    const result: DayGroup[] = [];
    for (let i = 0; i < 6; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);

      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(day.getDate()).padStart(2, "0")}`;

      const dayLessons = (map.get(key) || []).sort(
        (a, b) => a.study_ordinal - b.study_ordinal
      );

      result.push(buildDayGroup(key, dayLessons, todayISO, tomorrowISO));
    }

    return result;
  }, [lessons, weekOffset]);

  const weekLabel = getWeekRange(weekOffset).label;

  return (
    <div className="space-y-3 w-full">
      <Card className="w-full">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setWeekOffset((v) => v - 1)}
              disabled={loading}
            >
              ←
            </Button>
            <div className="text-[13px] font-semibold text-slate-700 min-w-[180px] text-center">
              {weekLabel}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setWeekOffset((v) => v + 1)}
              disabled={loading}
            >
              →
            </Button>
            {weekOffset !== 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setWeekOffset(0)}
                disabled={loading}
              >
                Сегодня
              </Button>
            )}
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => load(weekOffset)}
            disabled={loading}
          >
            {loading ? "Загружаю..." : "Обновить"}
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="w-full">
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-[13px]">
            {error}
          </div>
        </Card>
      )}

      {days.length === 0 && !loading && !error && (
        <Card className="w-full">
          <p className="text-slate-400 text-[13px] text-center py-6">
            На эту неделю уроков нет.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 w-full items-start">
        {days.map((d) => (
          <DayCard key={d.key} day={d} onOpen={setSelectedLesson} />
        ))}
      </div>

      {/* Модалка поверх всего */}
      <LessonModal
        lesson={selectedLesson}
        onClose={() => setSelectedLesson(null)}
      />
    </div>
  );
}

/* ============ Карточка дня ============ */

function DayCard({
  day,
  onOpen,
}: {
  day: DayGroup;
  onOpen: (l: Lesson) => void;
}) {
  const accent = day.isToday
    ? "border-blue-300 shadow-blue-200/50"
    : day.isTomorrow
      ? "border-violet-200"
      : "border-slate-200";

  return (
    <div
      className={`rounded-lg border bg-white shadow-sm ${accent} flex flex-col overflow-hidden`}
    >
      <div
        className={`px-3 py-2 border-b ${day.isToday
            ? "bg-gradient-to-r from-blue-50 to-violet-50 border-blue-100"
            : "bg-slate-50 border-slate-100"
          }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-[20px] font-bold leading-none ${day.isToday ? "text-blue-700" : "text-slate-800"
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
      </div>

      <div className="flex-1 p-1.5 space-y-1">
        {day.lessons.length === 0 && (
          <div className="text-[12px] text-slate-400 text-center py-6 flex flex-col items-center gap-1">
            <span className="text-[16px]">🎉</span>
            <span>Уроков нет</span>
          </div>
        )}

        {day.lessons.map((l, i) => (
          <LessonRow key={i} lesson={l} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

/* ============ Строка урока ============ */

function LessonRow({
  lesson,
  onOpen,
}: {
  lesson: Lesson;
  onOpen: (l: Lesson) => void;
}) {
  const groupLabel = shortGroupLabel(lesson.group_name);

  // Кабинет: сначала room_resolved_name (из /rooms), потом номер, потом имя
  const roomRaw =
    lesson.room_resolved_name ||
    lesson.room_number ||
    lesson.room_name ||
    "";
  const room = roomRaw.trim() || "Нет кабинета";
  const hasRoom = room !== "Нет кабинета";

  return (
    <button
      type="button"
      onClick={() => onOpen(lesson)}
      className={`w-full text-left rounded-md border transition px-2 py-1.5 flex items-center gap-2 ${lesson.replaced
          ? "bg-red-50/40 border-red-100 hover:bg-red-50"
          : "bg-slate-50/60 border-slate-100 hover:bg-slate-100"
        }`}
    >
      <span className="font-mono text-[11px] text-slate-500 shrink-0">
        {formatTime(lesson.time)}
      </span>
      <span className="flex-1 text-[12px] font-medium text-slate-800 truncate">
        {groupLabel}
      </span>
      <span
        className={`text-[10px] font-medium rounded px-1.5 py-0.5 shrink-0 border ${hasRoom
            ? "text-slate-600 bg-white border-slate-200"
            : "text-slate-400 bg-slate-50 border-slate-200 italic"
          }`}
      >
        {room}
      </span>
      {lesson.replaced && (
        <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 shrink-0">
          зам.
        </span>
      )}
    </button>
  );
}

/* ============ Модальное окно урока ============ */

function LessonModal({
  lesson,
  onClose,
}: {
  lesson: Lesson | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!lesson) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lesson, onClose]);

  if (!lesson) return null;

  const roomRaw =
    lesson.room_resolved_name ||
    lesson.room_number ||
    lesson.room_name ||
    "";
  const room = roomRaw.trim() || "Нет кабинета";
  const hasRoom = room !== "Нет кабинета";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50">
          <div className="min-w-0">
            <div className="text-[11px] font-mono text-slate-500 mb-0.5">
              {formatTime(lesson.time)}
            </div>
            <div className="text-[15px] font-semibold text-slate-900 leading-tight">
              {lesson.group_name || lesson.lesson_name || "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition text-[18px] leading-none shrink-0"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Содержимое */}
        <div className="px-5 py-4 space-y-2 text-[13px]">
          {lesson.lesson_name && (
            <Row label="Тема" value={lesson.lesson_name} />
          )}
          <Row label="Номер урока" value={String(lesson.study_ordinal)} />
          {lesson.group_name && (
            <Row label="Группа" value={lesson.group_name} />
          )}
          <Row label="Кабинет" value={room} muted={!hasRoom} />
          {lesson.teacher_name && (
            <Row label="Учитель" value={lesson.teacher_name} />
          )}
          {lesson.replaced && (
            <div className="pt-1">
              <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                Замена
              </span>
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-32 text-slate-400 text-[12px] shrink-0">{label}</div>
      <div
        className={`text-[13px] break-words ${muted ? "text-slate-400 italic" : "text-slate-800"
          }`}
      >
        {value}
      </div>
    </div>
  );
}