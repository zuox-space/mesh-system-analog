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
    is_no_hw_note?: boolean;
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

type DayCell = {
    date: string;
    lessons: Lesson[];
};

type WeekCell = {
    label: string;
    days: DayCell[];
};

type PeriodCell = {
    key: string;
    label: string;
    from: string;
    to: string;
    weeks: WeekCell[];
};

function isoToday(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseIso(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function isoOf(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShort(iso: string): string {
    const [, m, d] = iso.split("-");
    return `${d}.${m}`;
}

function formatFull(iso: string): string {
    const [, m, d] = iso.split("-");
    return `${d}.${m}`;
}

function getReportPeriods(today: Date): { from: string; to: string }[] {
    const y = today.getFullYear();
    const m = today.getMonth();

    let startYear: number;
    let startMonth: number;

    if (m >= 8) {
        startYear = y;
        startMonth = 8;
    } else {
        startYear = y - 1;
        startMonth = 8;
    }

    const periods: { from: string; to: string }[] = [];
    let cur = new Date(startYear, startMonth, 16);

    for (let i = 0; i < 12; i++) {
        const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 15);
        periods.push({ from: isoOf(cur), to: isoOf(nextMonth) });
        cur = new Date(nextMonth);
        cur.setDate(cur.getDate() + 1);
    }

    return periods;
}

function weekdayShort(iso: string): string {
    const d = parseIso(iso);
    const s = d.toLocaleDateString("ru-RU", { weekday: "short" });
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function HomeworkView() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [bulkRunning, setBulkRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editLesson, setEditLesson] = useState<Lesson | null>(null);
    const [createLesson, setCreateLesson] = useState<Lesson | null>(null);
    const [showPast, setShowPast] = useState(false);
    const { toasts, push, remove } = useToast();

    const todayIso = isoToday();
    const today = useMemo(() => new Date(), []);
    const periods = useMemo(() => getReportPeriods(today), [today]);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const requests = periods.map(({ from, to }) =>
                fetch(`/api/homework/groups?from=${from}&to=${to}`, {
                    cache: "no-store",
                }).then((r) => r.json().then((data) => ({ ok: r.ok, data, from, to })))
            );

            const results = await Promise.all(requests);

            const allGroups: Group[] = [];
            for (const res of results) {
                if (res.ok && res.data?.groups) {
                    allGroups.push(...res.data.groups);
                }
            }

            const byGroupId = new Map<number, Group>();
            for (const g of allGroups) {
                const existing = byGroupId.get(g.group_id);
                if (existing) {
                    existing.lessons.push(...g.lessons);
                } else {
                    byGroupId.set(g.group_id, { ...g, lessons: [...g.lessons] });
                }
            }

            for (const g of byGroupId.values()) {
                const seen = new Set<number>();
                g.lessons = g.lessons.filter((l) => {
                    if (seen.has(l.id)) return false;
                    seen.add(l.id);
                    return true;
                });
            }

            setGroups([...byGroupId.values()]);
            setHasLoadedOnce(true);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const periodCells: PeriodCell[] = useMemo(() => {
        const byDate = new Map<string, Lesson[]>();
        for (const l of allLessons) {
            if (!l.date) continue;
            if (!byDate.has(l.date)) byDate.set(l.date, []);
            byDate.get(l.date)!.push(l);
        }
        for (const arr of byDate.values()) {
            arr.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        }

        const result: PeriodCell[] = [];

        for (const { from, to } of periods) {
            const datesInPeriod: string[] = [];
            for (const date of byDate.keys()) {
                if (date >= from && date <= to) datesInPeriod.push(date);
            }
            datesInPeriod.sort();

            if (datesInPeriod.length === 0) continue;

            const weeks: WeekCell[] = [];
            let currentWeekDays: DayCell[] = [];
            let lastMonday = "";

            for (const date of datesInPeriod) {
                const d = parseIso(date);
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

            result.push({
                key: from,
                label: `${formatFull(from)} — ${formatFull(to)}`,
                from,
                to,
                weeks,
            });
        }

        return result;
    }, [allLessons, periods]);

    const lessonsToFill = useMemo(
        () =>
            allLessons.filter(
                (l) => l.date && !l.has_homework && l.date >= todayIso
            ),
        [allLessons, todayIso]
    );

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
        if (!lesson.date) return;

        if (lesson.has_homework && lesson.homework_id) {
            setEditLesson(lesson);
            return;
        }

        if (lesson.has_homework && !lesson.homework_id) {
            setCreateLesson(lesson);
            return;
        }

        if (!lesson.has_homework) {
            setCreateLesson(lesson);
        }
    }

    const visiblePeriods = showPast
        ? periodCells
        : periodCells.filter((p) => p.to >= todayIso);

    const hasPastPeriods = periodCells.some((p) => p.to < todayIso);

    return (
        <div className="space-y-3 w-full">
            <Card className="w-full !py-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={load}
                            disabled={loading}
                        >
                            {loading ? "Загружаю..." : "Обновить"}
                        </Button>
                        {loading && (
                            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        )}
                    </div>

                    {hasPastPeriods && (
                        <label className="flex items-center gap-2 cursor-pointer select-none text-[12px] text-slate-600">
                            <input
                                type="checkbox"
                                checked={showPast}
                                onChange={(e) => setShowPast(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            Показать прошедшие периоды
                        </label>
                    )}

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

            {loading && !hasLoadedOnce && (
                <div className="space-y-3 w-full">
                    {[0, 1, 2].map((i) => (
                        <SkeletonPeriod key={i} />
                    ))}
                </div>
            )}

            {hasLoadedOnce && (
                <div
                    className={`space-y-3 w-full transition-opacity ${loading ? "opacity-50 pointer-events-none" : "opacity-100"
                        }`}
                >
                    {visiblePeriods.map((p) => (
                        <PeriodBlock
                            key={p.key}
                            period={p}
                            todayIso={todayIso}
                            onLessonClick={handleLessonClick}
                        />
                    ))}
                </div>
            )}

            {hasLoadedOnce && visiblePeriods.length === 0 && !loading && !error && (
                <Card className="w-full">
                    <p className="text-slate-400 text-[13px] text-center py-6">
                        Нет данных за учебный год.
                    </p>
                </Card>
            )}

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

/* ============ Период ============ */

function PeriodBlock({
    period,
    todayIso,
    onLessonClick,
}: {
    period: PeriodCell;
    todayIso: string;
    onLessonClick: (l: Lesson) => void;
}) {
    const totalLessons = period.weeks.reduce(
        (acc, w) => acc + w.days.reduce((a, d) => a + d.lessons.length, 0),
        0
    );
    const withoutHw = period.weeks.reduce(
        (acc, w) =>
            acc +
            w.days.reduce(
                (a, d) =>
                    a + d.lessons.filter((l) => !l.has_homework && l.date! >= todayIso).length,
                0
            ),
        0
    );

    const isPastPeriod = period.to < todayIso;
    const isCurrentPeriod = period.from <= todayIso && period.to >= todayIso;

    return (
        <Card className={`w-full !py-3 ${isPastPeriod ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="flex items-baseline gap-2">
                    <h3
                        className={`text-[14px] font-semibold ${isCurrentPeriod
                            ? "text-blue-700"
                            : isPastPeriod
                                ? "text-slate-500"
                                : "text-slate-800"
                            }`}
                    >
                        {period.label}
                    </h3>
                    {isCurrentPeriod && (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                            текущий период
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-slate-500">
                        уроков: <b className="text-slate-700">{totalLessons}</b>
                    </span>
                    {withoutHw > 0 && (
                        <span className="text-amber-600">
                            без ДЗ: <b>{withoutHw}</b>
                        </span>
                    )}
                </div>
            </div>

            <div className="flex flex-row gap-3 overflow-x-auto pb-1">
                {period.weeks.map((week, wi) => (
                    <WeekColumn
                        key={wi}
                        week={week}
                        todayIso={todayIso}
                        onLessonClick={onLessonClick}
                    />
                ))}
            </div>
        </Card>
    );
}

function WeekColumn({
    week,
    todayIso,
    onLessonClick,
}: {
    week: WeekCell;
    todayIso: string;
    onLessonClick: (l: Lesson) => void;
}) {
    return (
        <div className="flex flex-col gap-1 min-w-[210px] shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium pb-1 border-b border-slate-100">
                {week.label}
            </div>

            <div className="flex flex-col gap-0.5">
                {week.days.map((day) => (
                    <DayRow
                        key={day.date}
                        day={day}
                        todayIso={todayIso}
                        onLessonClick={onLessonClick}
                    />
                ))}
            </div>
        </div>
    );
}

function DayRow({
    day,
    todayIso,
    onLessonClick,
}: {
    day: DayCell;
    todayIso: string;
    onLessonClick: (l: Lesson) => void;
}) {
    const isToday = day.date === todayIso;
    const isPast = day.date < todayIso;

    return (
        <div
            className={`flex items-center gap-2 px-1.5 py-1 rounded-md ${isToday
                ? "bg-blue-50 border border-blue-200"
                : isPast
                    ? "bg-slate-50/40"
                    : "bg-white"
                } ${isPast ? "opacity-60" : ""}`}
        >
            <div className="flex items-baseline gap-1 w-[68px] shrink-0">
                <span
                    className={`text-[11px] font-mono font-semibold ${isToday
                        ? "text-blue-700"
                        : isPast
                            ? "text-slate-400"
                            : "text-slate-600"
                        }`}
                >
                    {formatShort(day.date)}
                </span>
                <span
                    className={`text-[9px] uppercase ${isPast ? "text-slate-300" : "text-slate-400"
                        }`}
                >
                    {weekdayShort(day.date)}
                </span>
            </div>

            <div className="flex-1 flex flex-wrap gap-1">
                {day.lessons.map((l) => (
                    <LessonSquare key={l.id} lesson={l} onClick={() => onLessonClick(l)} />
                ))}
            </div>
        </div>
    );
}

function LessonSquare({
    lesson,
    onClick,
}: {
    lesson: Lesson;
    onClick: () => void;
}) {
    const todayIso = isoToday();
    const isPast = !!lesson.date && lesson.date < todayIso;
    const hasHw = lesson.has_homework;
    const isNoHwNote = lesson.is_no_hw_note === true && !lesson.homework_id;

    // Заголовок: класс + тема
    const className_ = lesson.group_name || lesson.class_unit_name || "";
    const topic = lesson.lesson_name || "";

    let statusLine = "";
    if (hasHw) {
        if (isNoHwNote) {
            statusLine = `${lesson.time} — ДЗ отмечено (без текста задания)`;
        } else {
            statusLine = `${lesson.time} — ДЗ задано`;
            if (lesson.homework_text) {
                statusLine += `: ${lesson.homework_text.slice(0, 80)}`;
            }
        }
    } else if (isPast) {
        statusLine = `${lesson.time} — пропущено (ДЗ не задано)`;
    } else {
        statusLine = `${lesson.time} — не задано`;
    }

    let colorClass = "";
    if (hasHw) {
        colorClass = isPast
            ? "bg-emerald-200 border-emerald-300 hover:bg-emerald-300"
            : "bg-emerald-500 border-emerald-600 hover:bg-emerald-600";
    } else if (isPast) {
        colorClass = "bg-red-200 border-red-300 hover:bg-red-300";
    } else {
        colorClass = "bg-amber-400 border-amber-500 hover:bg-amber-500";
    }

    const tooltip = [
        className_,
        topic,
        statusLine,
    ]
        .filter(Boolean)
        .join("\n");

    return (
        <div
            title={tooltip}
            onClick={onClick}
            className={`relative w-6 h-6 rounded-sm border transition cursor-pointer hover:scale-110 ${colorClass}`}
        >
            {isNoHwNote && (
                <span
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 border border-white shadow-sm"
                    aria-hidden="true"
                />
            )}
        </div>
    );
}

function SkeletonPeriod() {
    return (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3 animate-pulse">
            <div className="flex items-center justify-between mb-3">
                <div className="h-5 w-40 bg-slate-200 rounded" />
                <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
            <div className="flex flex-row gap-3 overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex flex-col gap-1 min-w-[210px]">
                        <div className="h-3 w-24 bg-slate-100 rounded mb-1" />
                        <div className="h-5 w-full bg-slate-50 rounded" />
                        <div className="h-5 w-full bg-slate-50 rounded" />
                        <div className="h-5 w-3/4 bg-slate-50 rounded" />
                    </div>
                ))}
            </div>
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
    const [description, setDescription] = useState("Без домашнего задания");
    const todayIso = isoToday();
    const isPast = !!lesson.date && lesson.date < todayIso;
    const isNoHwNote = lesson.is_no_hw_note === true && !lesson.homework_id;
    const hasNoHw = !lesson.has_homework;

    async function save() {
        if (!lesson.date) return;
        if (isPast) return;
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

                {isPast && (
                    <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-[12px] text-amber-800">
                        {isNoHwNote
                            ? "⚠ Урок прошёл. ДЗ отмечено особым способом (без текста). Изменения недоступны."
                            : hasNoHw
                                ? "⚠ Урок уже прошёл — ДЗ не было задано на эту дату."
                                : "⚠ Урок прошёл — изменения недоступны."}
                    </div>
                )}

                {!isPast && isNoHwNote && (
                    <div className="px-5 py-2 bg-sky-50 border-b border-sky-200 text-[12px] text-sky-800">
                        ℹ На этом уроке ДЗ отмечено особым способом (без текста задания).
                        Задайте новое — оно заменит текущую отметку.
                    </div>
                )}

                <div className="px-5 py-4">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        Текст домашнего задания
                    </label>
                    <textarea
                        value={isPast ? "" : description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={8}
                        placeholder={
                            isPast
                                ? isNoHwNote
                                    ? "ДЗ отмечено особым способом (без текста)"
                                    : "ДЗ не было задано"
                                : isNoHwNote
                                    ? "Введите текст нового ДЗ — оно заменит текущую отметку"
                                    : "Например: §14, упр. 3, 4"
                        }
                        disabled={isPast}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200/60 transition disabled:bg-slate-50 disabled:text-slate-400 disabled:italic"
                        autoFocus={!isPast}
                    />
                </div>

                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={onClose}>
                        {isPast ? "Закрыть" : "Отмена"}
                    </Button>
                    {!isPast && (
                        <Button
                            size="sm"
                            variant="primary"
                            onClick={save}
                            disabled={saving}
                        >
                            {saving ? "Сохраняю..." : "Задать ДЗ"}
                        </Button>
                    )}
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
    const todayIso = isoToday();
    const isPast = !!lesson.date && lesson.date < todayIso;

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
            } catch { }
            setLoading(false);
        })();
    }, [lesson.homework_id]);

    async function save() {
        if (!lesson.homework_id) return;
        if (isPast) return;
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

                {isPast && (
                    <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-[12px] text-amber-800">
                        ⚠ Урок уже прошёл — изменения недоступны (только просмотр)
                    </div>
                )}

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
                                disabled={isPast}
                                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] font-mono text-slate-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200/60 transition disabled:bg-slate-50 disabled:text-slate-400"
                            />
                        </>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={onClose}>
                        {isPast ? "Закрыть" : "Отмена"}
                    </Button>
                    {!isPast && (
                        <Button
                            size="sm"
                            variant="primary"
                            onClick={save}
                            disabled={saving || loading}
                        >
                            {saving ? "Сохраняю..." : "Сохранить"}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ============ Утилиты ============ */

function makeWeek(days: DayCell[]): WeekCell {
    const first = parseIso(days[0].date);
    const dow = first.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(first);
    monday.setDate(first.getDate() + diffToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const monShort = `${String(monday.getDate()).padStart(2, "0")}.${String(
        monday.getMonth() + 1
    ).padStart(2, "0")}`;
    const sunShort = `${String(sunday.getDate()).padStart(2, "0")}.${String(
        sunday.getMonth() + 1
    ).padStart(2, "0")}`;

    return {
        label: `${monShort} – ${sunShort}`,
        days,
    };
}