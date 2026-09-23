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
    label: string;
    weekday: string;
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

function buildDayLabel(iso: string): { label: string; weekday: string } {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);

    const todayISO = isoToday();
    const tomorrowISO = isoPlusDays(1);

    const weekdayShort = date.toLocaleDateString("ru-RU", { weekday: "short" });
    const weekday = weekdayShort.charAt(0).toUpperCase() + weekdayShort.slice(1);
    const monthName = date.toLocaleDateString("ru-RU", { month: "long" });
    const dd = String(d).padStart(2, "0");

    if (iso === todayISO) return { label: `Сегодня, ${dd} ${monthName}`, weekday };
    if (iso === tomorrowISO)
        return { label: `Завтра, ${dd} ${monthName}`, weekday };
    return { label: `${dd} ${monthName}`, weekday };
}

/** Короткий текст ДЗ — первые ~70 символов, переносы схлопнуты */
function shortHomework(text: string): string {
    if (!text) return "";
    const single = text.replace(/\s+/g, " ").trim();
    if (single.length <= 70) return single;
    return single.slice(0, 70).trim() + "…";
}

export function HomeworkView() {
    const [dateFrom, setDateFrom] = useState(isoToday());
    const [dateTo, setDateTo] = useState(isoPlusDays(14));
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [bulkRunning, setBulkRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editLesson, setEditLesson] = useState<Lesson | null>(null);
    const [createLesson, setCreateLesson] = useState<Lesson | null>(null);
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

        const result: DayBucket[] = [];
        for (const [key, lessons] of [...map.entries()].sort(([a], [b]) =>
            a.localeCompare(b)
        )) {
            const { label, weekday } = buildDayLabel(key);
            result.push({
                key,
                label,
                weekday,
                isToday: key === todayIso,
                isTomorrow: key === isoPlusDays(1),
                isPast: key < todayIso,
                lessons: lessons.sort((a, b) =>
                    (a.time || "").localeCompare(b.time || "")
                ),
            });
        }
        return result;
    }, [allLessons, todayIso]);

    const futureDays = days.filter((d) => !d.isPast);
    const pastDays = days.filter((d) => d.isPast);

    const lessonsToFill = useMemo(
        () =>
            allLessons.filter(
                (l) => l.date && !l.has_homework && !isPast(l.date, todayIso)
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
        if (lesson.has_to_give && lesson.homework_id) {
            setEditLesson(lesson);
        } else if (!lesson.has_homework && !isPast(lesson.date, todayIso)) {
            setCreateLesson(lesson);
        }
    }

    return (
        <div className="space-y-3 w-full">
            {/* ============ Пульт управления ============ */}
            <Card className="w-full !py-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
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

                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={load}
                        disabled={loading}
                    >
                        {loading ? "..." : "Обновить"}
                    </Button>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="text-[12px] text-slate-600">
                        Уроков без ДЗ на будущих датах:{" "}
                        <span className="font-semibold text-amber-600">
                            {lessonsToFill.length}
                        </span>
                    </div>
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={bulkSetEmpty}
                        disabled={bulkRunning || lessonsToFill.length === 0}
                    >
                        {bulkRunning ? "Обрабатываю..." : "Заполнить все без ДЗ"}
                    </Button>
                </div>

                {error && (
                    <div className="mt-2 text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1 text-[12px]">
                        {error}
                    </div>
                )}
            </Card>

            {/* ============ Будущие дни ============ */}
            {futureDays.map((day) => (
                <DaySection
                    key={day.key}
                    day={day}
                    todayIso={todayIso}
                    onClickLesson={handleLessonClick}
                    onSetEmpty={setEmpty}
                />
            ))}

            {/* ============ Прошедшие дни ============ */}
            {pastDays.length > 0 && (
                <PastDaysSection days={pastDays} onClickLesson={handleLessonClick} />
            )}

            {days.length === 0 && !loading && !error && (
                <Card className="w-full">
                    <p className="text-slate-400 text-[13px] text-center py-6">
                        Уроков за период нет.
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

/* ============ Кнопка быстрого периода ============ */

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
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${active
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
        >
            {children}
        </button>
    );
}

/* ============ Секция дня ============ */

function DaySection({
    day,
    todayIso,
    onClickLesson,
    onSetEmpty,
}: {
    day: DayBucket;
    todayIso: string;
    onClickLesson: (l: Lesson) => void;
    onSetEmpty: (l: Lesson) => void;
}) {
    const withoutHw = day.lessons.filter((l) => !l.has_homework).length;

    return (
        <div className="w-full">
            <div
                className={`flex items-baseline justify-between gap-3 px-1 mb-1 ${day.isToday ? "text-blue-700" : "text-slate-700"
                    }`}
            >
                <div className="flex items-baseline gap-2">
                    <h3 className="text-[13px] font-semibold">{day.label}</h3>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wide">
                        {day.weekday}
                    </span>
                </div>
                {withoutHw > 0 && (
                    <span className="text-[11px] text-amber-600 font-medium">
                        без ДЗ: {withoutHw}
                    </span>
                )}
            </div>

            <div
                className={`rounded-lg border bg-white overflow-hidden shadow-sm ${day.isToday ? "border-blue-200" : "border-slate-200"
                    }`}
            >
                <div className="divide-y divide-slate-100">
                    {day.lessons.map((l) => (
                        <LessonRow
                            key={l.id}
                            lesson={l}
                            today={day.isToday}
                            past={false}
                            onClick={() => onClickLesson(l)}
                            onSetEmpty={() => onSetEmpty(l)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ============ Прошедшие дни ============ */

function PastDaysSection({
    days,
    onClickLesson,
}: {
    days: DayBucket[];
    onClickLesson: (l: Lesson) => void;
}) {
    const [open, setOpen] = useState(false);
    const totalLessons = days.reduce((acc, d) => acc + d.lessons.length, 0);

    return (
        <div className="w-full">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 px-1 mb-1 text-[13px] font-semibold text-slate-400 hover:text-slate-600"
            >
                <span className="text-[10px]">{open ? "▾" : "▸"}</span>
                <span>Прошедшие ({totalLessons})</span>
            </button>

            {open && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
                    <div className="divide-y divide-slate-100">
                        {days.map((day) => (
                            <div key={day.key}>
                                <div className="px-3 py-1 text-[11px] text-slate-400 uppercase tracking-wide bg-slate-50">
                                    {day.label}
                                </div>
                                {day.lessons.map((l) => (
                                    <LessonRow
                                        key={l.id}
                                        lesson={l}
                                        today={false}
                                        past={true}
                                        onClick={() => onClickLesson(l)}
                                        onSetEmpty={() => { }}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
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
    const canAct = !past && !hasHw;
    const clickable = !past && (lesson.has_to_give || canAct);

    const accentColor = past
        ? "bg-slate-300"
        : hasHw
            ? "bg-emerald-400"
            : "bg-amber-400";

    return (
        <div
            className={`relative flex items-center gap-3 pl-4 pr-3 py-2.5 text-[13px] transition ${clickable ? "cursor-pointer hover:bg-slate-50" : ""
                } ${past ? "opacity-60" : ""} ${today ? "bg-blue-50/30" : ""}`}
            onClick={clickable ? onClick : undefined}
        >
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />

            <span
                className={`font-mono text-[12px] w-12 shrink-0 ${today ? "text-blue-700 font-semibold" : "text-slate-500"
                    }`}
            >
                {lesson.time || "—"}
            </span>

            {/* Группа + краткий текст ДЗ */}
            <div className="flex-1 min-w-0">
                <div className="text-slate-800 font-medium truncate">
                    {lesson.group_name || lesson.class_unit_name}
                </div>
                {hasHw && lesson.homework_text ? (
                    <div
                        className="text-[11px] text-slate-500 truncate mt-0.5 hover:text-slate-700"
                        title="Показать полностью"
                    >
                        {shortHomework(lesson.homework_text)}
                    </div>
                ) : hasHw && !lesson.homework_text ? (
                    <div className="text-[11px] text-slate-400 italic mt-0.5">
                        (текст не загружен)
                    </div>
                ) : !past ? (
                    <div className="text-[11px] text-amber-600/80 mt-0.5">
                        не задано
                    </div>
                ) : null}
            </div>

            <span className="hidden lg:inline text-[11px] text-slate-400 shrink-0">
                {lesson.student_ids.length} уч.
            </span>

            {/* Действие */}
            <div className="shrink-0 flex items-center gap-2 ml-1">
                {past ? (
                    <span className="text-[11px] text-slate-400 italic">прошло</span>
                ) : hasHw ? (
                    lesson.has_to_give ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClick();
                            }}
                            className="text-[12px] text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                            изменить
                        </button>
                    ) : (
                        <span className="text-[11px] text-slate-400">проверить</span>
                    )
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClick();
                            }}
                            className="text-[12px] text-blue-600 hover:text-blue-800 font-medium hover:underline"
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
                            className="w-6 h-6 rounded-md border border-slate-200 text-slate-400 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 flex items-center justify-center transition text-[12px]"
                        >
                            ✕
                        </button>
                    </>
                )}
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
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px]"
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
            } catch { }
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
                                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono"
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