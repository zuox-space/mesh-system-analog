// src/app/dashboard/homework/HomeworkView.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast, ToastContainer } from "@/components/ui/Toast";

type Lesson = {
  id: number;
  date: string | null;
  time: string;
  study_ordinal: number;
  lesson_name: string;
  room_name: string;
  has_homework: boolean;
  has_to_give: boolean;
  has_to_verify: boolean;
  is_absences?: boolean;
  homework_id: number | null;
  homework_text?: string;
  group_id: number;
  group_name: string;
  class_unit_name: string;
  subject_id: number;
  student_ids: number[];
};

type Group = {
  group_id: number;
  group_name: string;
  class_unit_name: string;
  subject_id: number;
  subject_name: string;
  student_ids: number[];
  lessons: Lesson[];
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

function isPast(dateIso: string | null, todayIso: string): boolean {
  if (!dateIso) return false;
  return dateIso < todayIso;
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

/** Короткий текст ДЗ — 60 символов, переносы схлопнуты */
function shortHomework(text: string): string {
  if (!text) return "";
  const single = text.replace(/\s+/g, " ").trim();
  if (single.length <= 60) return single;
  return single.slice(0, 60).trim() + "…";
}

/** Первое слово названия урока */
function shortLessonName(name: string): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  const first = words[0] || "";
  return first.length > 14 ? first.slice(0, 13) + "…" : first;
}

export function HomeworkView() {
  const [dateFrom, setDateFrom] = useState(isoToday());
  const [dateTo, setDateTo] = useState(isoPlusDays(14));
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [createLesson, setCreateLesson] = useState<Lesson | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const { toasts, push, remove } = useToast();

  const todayIso = isoToday();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/homework/groups?from=${dateFrom}&to=${dateTo}`,
        { cache: "no-store" }
      );
      const data = await r.json();
      if (!r.ok) {
        setError(data.detail || "Ошибка загрузки");
        return;
      }
      setGroups(data.groups || []);
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

  const allLessons: Lesson[] = useMemo(() => {
    const out: Lesson[] = [];
    for (const g of groups) {
      for (const l of g.lessons) {
        out.push({
          ...l,
          group_id: g.group_id,
          group_name: g.group_name,
          class_unit_name: g.class_unit_name,
          subject_id: g.subject_id,
          student_ids: g.student_ids,
        });
      }
    }
    return out;
  }, [groups]);

  const days: DayBucket[] = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const l of allLessons) {
      if (!l.date) continue;
      if (!map.has(l.date)) map.set(l.date, []);
      map.get(l.date)!.push(l);
    }

    const tomorrowIso = isoPlusDays(1);

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, lessons]) =>
        buildDayBucket(
          key,
          lessons.sort((a, b) => (a.time || "").localeCompare(b.time || "")),
          todayIso,
          tomorrowIso
        )
      );
  }, [allLessons, todayIso]);

  const futureDays = days.filter((d) => !d.isPast);
  const pastDays = days.filter((d) => d.isPast);

  const lessonsToFill = useMemo(
    () =>
      allLessons.filter(
        (l) =>
          l.date &&
          !l.has_homework &&
          !l.is_absences &&
          !isPast(l.date, todayIso)
      ),
    [allLessons, todayIso]
  );

  async function setEmpty(lesson: Lesson) {
    if (!lesson.date) return;
    if (isPast(lesson.date, todayIso)) {
      push("Нельзя проставить ДЗ задним числом", "err");
      return;
    }

    const r = await fetch("/api/homework/set-empty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_id: lesson.group_id,
        subject_id: lesson.subject_id,
        date_assigned_on: lesson.date,
        date_prepared_for: lesson.date,
        student_ids: lesson.student_ids,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      push("Ошибка: " + (data.detail || "неизвестно"), "err");
      return;
    }
    push("Без ДЗ проставлено", "ok");
    load();
  }

  async function bulkSetEmpty() {
    if (lessonsToFill.length === 0) {
      push("Нет уроков без ДЗ на будущие даты", "err");
      return;
    }

    if (
      !confirm(
        `Проставить «без ДЗ» на ${lessonsToFill.length} уроков (только сегодня и вперёд)?`
      )
    ) {
      return;
    }

    setBulkRunning(true);
    try {
      const r = await fetch("/api/homework/set-empty-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lessonsToFill.map((l) => ({
            group_id: l.group_id,
            subject_id: l.subject_id,
            date_assigned_on: l.date,
            date_prepared_for: l.date,
            student_ids: l.student_ids,
          })),
        }),
      });

      const data = await r.json();
      if (!r.ok) {
        push("Ошибка: " + (data.detail || "неизвестно"), "err");
        return;
      }

      push(
        `Обработано ${data.ok_count} из ${data.total}`,
        data.failed?.length > 0 ? "err" : "ok"
      );
      load();
    } catch (e: any) {
      push("Ошибка: " + e.message, "err");
    } finally {
      setBulkRunning(false);
    }
  }

  function handleLessonClick(lesson: Lesson) {
    if (lesson.is_absences) return;

    // Редактируем — если ДЗ задано именно на этот урок (есть homework_id)
    if (lesson.has_to_give && lesson.homework_id) {
      setEditLesson(lesson);
      return;
    }

    // Создаём новое — если ДЗ нет
    if (!lesson.has_homework && !isPast(lesson.date, todayIso)) {
      setCreateLesson(lesson);
    }
  }

  return (
    <div className="space-y-3 w-full">
      {/* ============ Пульт ============ */}
      <Card className="w-full !py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
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
              active={dateFrom === isoToday() && dateTo === isoToday()}
              onClick={() => {
                setDateFrom(isoToday());
                setDateTo(isoToday());
              }}
            >
              Сегодня
            </QuickBtn>
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

          {dateFrom === isoToday() && (
            <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
              с сегодня
            </span>
          )}

          <div className="flex items-center gap-2">
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

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-slate-500">
              без ДЗ: <b>{lessonsToFill.length}</b>
            </span>
            <Button
              size="sm"
              variant="primary"
              onClick={bulkSetEmpty}
              disabled={bulkRunning || lessonsToFill.length === 0}
            >
              {bulkRunning ? "..." : "Заполнить все без ДЗ"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-2 text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1 text-[12px]">
            {error}
          </div>
        )}
      </Card>

      {/* ============ Скелетоны при первой загрузке ============ */}
      {loading && !hasLoadedOnce && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 w-full items-start">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ============ Сетка карточек по дням ============ */}
      {hasLoadedOnce && (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 w-full items-start transition-opacity ${
            loading ? "opacity-50 pointer-events-none" : "opacity-100"
          }`}
        >
          {futureDays.map((d) => (
            <DayCard
              key={d.key}
              day={d}
              onClickLesson={handleLessonClick}
              onSetEmpty={setEmpty}
            />
          ))}
        </div>
      )}

      {/* ============ Прошедшие ============ */}
      {hasLoadedOnce && pastDays.length > 0 && (
        <div className="w-full">
          <button
            type="button"
            onClick={() => setPastOpen((v) => !v)}
            className="flex items-center gap-2 px-1 mb-1 text-[13px] font-semibold text-slate-400 hover:text-slate-600"
          >
            <span className="text-[10px]">{pastOpen ? "▾" : "▸"}</span>
            <span>
              Прошедшие (
              {pastDays.reduce((acc, d) => acc + d.lessons.length, 0)})
            </span>
          </button>

          {pastOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 w-full items-start">
              {pastDays.map((d) => (
                <DayCard
                  key={d.key}
                  day={d}
                  onClickLesson={() => {}}
                  onSetEmpty={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {hasLoadedOnce && days.length === 0 && !loading && !error && (
        <Card className="w-full">
          <p className="text-slate-400 text-[13px] text-center py-6">
            Уроков за период нет.
          </p>
        </Card>
      )}

      {/* ============ Модалки ============ */}
      {editLesson && (
        <EditModal
          lesson={editLesson}
          onClose={() => setEditLesson(null)}
          onSaved={() => {
            setEditLesson(null);
            load();
          }}
          toast={push}
        />
      )}

      {createLesson && (
        <CreateModal
          lesson={createLesson}
          onClose={() => setCreateLesson(null)}
          onSaved={() => {
            setCreateLesson(null);
            load();
          }}
          toast={push}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={remove} />
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

/* ============ Скелетон карточки дня ============ */

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
        <div className="rounded-md border border-slate-100 bg-slate-50/60 p-2 space-y-1">
          <div className="h-3 w-2/3 bg-slate-200 rounded" />
          <div className="h-2.5 w-5/6 bg-slate-100 rounded" />
        </div>
      </div>
    </div>
  );
}

/* ============ Карточка дня ============ */

function DayCard({
  day,
  onClickLesson,
  onSetEmpty,
}: {
  day: DayBucket;
  onClickLesson: (l: Lesson) => void;
  onSetEmpty: (l: Lesson) => void;
}) {
  const accent = day.isToday
    ? "border-blue-300 shadow-blue-200/50"
    : day.isTomorrow
    ? "border-violet-200"
    : day.isPast
    ? "border-slate-200 opacity-70"
    : "border-slate-200";

  const withoutHw = day.lessons.filter(
    (l) => !l.has_homework && !l.is_absences && !day.isPast
  ).length;

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
        {withoutHw > 0 && (
          <div className="text-[10px] text-amber-600 font-medium mt-1">
            без ДЗ: {withoutHw}
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
            onClick={() => onClickLesson(l)}
            onSetEmpty={() => onSetEmpty(l)}
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
  onClick,
  onSetEmpty,
}: {
  lesson: Lesson;
  today: boolean;
  past: boolean;
  onClick: () => void;
  onSetEmpty: () => void;
}) {
  const hasHw = lesson.has_homework;
  const isAbsences = lesson.is_absences === true;
  const canAct = !past && !hasHw && !isAbsences;
  const clickable = !past && !isAbsences && (lesson.has_to_give || canAct);

  return (
    <div
      className={`rounded-md border transition ${
        past
          ? "bg-slate-50/60 border-slate-100"
          : isAbsences
          ? "bg-slate-50/60 border-slate-100"
          : hasHw
          ? "bg-emerald-50/40 border-emerald-100"
          : "bg-amber-50/40 border-amber-100"
      } ${clickable ? "hover:bg-slate-100/60 cursor-pointer" : ""}`}
      onClick={clickable ? onClick : undefined}
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
        {isAbsences ? (
          <div className="text-[10px] text-slate-500 mt-0.5">без ДЗ</div>
        ) : hasHw && lesson.homework_text ? (
          <div
            className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2"
            title={lesson.homework_text}
          >
            {shortHomework(lesson.homework_text)}
          </div>
        ) : hasHw ? (
          <div className="text-[10px] text-slate-500 mt-0.5">задано</div>
        ) : past ? (
          <div className="text-[10px] text-slate-400 italic mt-0.5">
            прошло
          </div>
        ) : (
          <div className="text-[10px] text-amber-600 mt-0.5">не задано</div>
        )}
      </div>

      {!past && !isAbsences && (
        <div className="flex items-center justify-end gap-2 px-2 pb-1.5">
          {hasHw && lesson.has_to_give ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              title="Редактировать ДЗ"
              className="w-5 h-5 rounded border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 flex items-center justify-center transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          ) : !hasHw ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-medium hover:underline whitespace-nowrap"
              >
                задать
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetEmpty();
                }}
                title="Проставить «Без домашнего задания»"
                className="text-[10px] text-amber-700 hover:text-amber-900 font-medium hover:underline whitespace-nowrap"
              >
                без ДЗ
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ============ Модалка «Задать ДЗ» ============ */

function CreateModal({
  lesson,
  onClose,
  onSaved,
  toast,
}: {
  lesson: Lesson;
  onClose: () => void;
  onSaved: () => void;
  toast: (text: string, type?: "ok" | "err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");

  async function save() {
    if (!lesson.date) return;
    if (!description.trim()) {
      toast("Введите текст ДЗ", "err");
      return;
    }

    setSaving(true);
    try {
      const r = await fetch("/api/homework/set-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: lesson.group_id,
          subject_id: lesson.subject_id,
          date_assigned_on: lesson.date,
          date_prepared_for: lesson.date,
          student_ids: lesson.student_ids,
          description,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast("Ошибка: " + (data.detail || "неизвестно"), "err");
        return;
      }
      toast("ДЗ задано", "ok");
      onSaved();
    } catch (e: any) {
      toast("Ошибка: " + e.message, "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50">
          <div className="min-w-0">
            <div className="text-[11px] font-mono text-slate-500 mb-0.5">
              {lesson.date} · {lesson.time}
            </div>
            <div className="text-[14px] font-semibold text-slate-900 leading-tight">
              {lesson.group_name || lesson.class_unit_name}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {lesson.lesson_name || ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-[18px]"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Текст домашнего задания
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            placeholder="Например: §14, упр. 3, 4"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200/60 transition"
            autoFocus
          />
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" variant="primary" onClick={save} disabled={saving}>
            {saving ? "Сохраняю..." : "Задать ДЗ"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============ Модалка редактирования ============ */

function EditModal({
  lesson,
  onClose,
  onSaved,
  toast,
}: {
  lesson: Lesson;
  onClose: () => void;
  onSaved: () => void;
  toast: (text: string, type?: "ok" | "err") => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    (async () => {
      if (!lesson.homework_id) return;
      setLoading(true);
      try {
        const r = await fetch(
          `/api/homework/update?id=${lesson.homework_id}`,
          { cache: "no-store" }
        );
        const data = await r.json();
        if (r.ok && data.homework) {
          const entries = data.homework.homework_entries || [];
          setDescription(entries[0]?.description || "");
        }
      } catch {}
      setLoading(false);
    })();
  }, [lesson.homework_id]);

  async function save() {
    if (!lesson.homework_id) return;
    setSaving(true);
    try {
      const r = await fetch("/api/homework/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homework_id: lesson.homework_id,
          description,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast("Ошибка: " + (data.detail || "неизвестно"), "err");
        return;
      }
      toast("Сохранено", "ok");
      onSaved();
    } catch (e: any) {
      toast("Ошибка: " + e.message, "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50">
          <div className="min-w-0">
            <div className="text-[11px] font-mono text-slate-500 mb-0.5">
              {lesson.date} · {lesson.time}
            </div>
            <div className="text-[14px] font-semibold text-slate-900 leading-tight">
              {lesson.group_name || lesson.class_unit_name}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {lesson.lesson_name || ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-[18px]"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div className="text-[13px] text-slate-400 italic text-center py-6">
              Загружаю...
            </div>
          ) : (
            <>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Текст домашнего задания
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] font-mono text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200/60 transition"
              />
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={save}
            disabled={saving || loading}
          >
            {saving ? "Сохраняю..." : "Сохранить"}
          </Button>
        </div>
      </div>
    </div>
  );
}