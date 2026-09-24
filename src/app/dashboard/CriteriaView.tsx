// src/app/dashboard/CriteriaView.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast, ToastContainer } from "@/components/ui/Toast";

type MissingLesson = {
  group_id: number;
  group_name: string;
  date: string;
  time: string;
  lesson_name: string;
  subject_id: number;
  student_ids: number[];
  plan_id: number | null;
};

type Criteria = {
  period: { from: string; to: string };
  today: string;

  total_lessons: number;
  total_past: number;
  total_future: number;

  ktp_linked: number;
  ktp_missing: number;
  ktp_percent: number;
  ktp_max_percent: number;
  ktp_target: number;
  ktp_passed: boolean;
  ktp_reachable: boolean;
  ktp_missing_lessons: MissingLesson[];

  hw_given: number;
  hw_missing: number;
  hw_percent: number;
  hw_max_percent: number;
  hw_target: number;
  hw_passed: boolean;
  hw_reachable: boolean;
  hw_missing_lessons: MissingLesson[];

  overall_passed: boolean;
  overall_reachable: boolean;
};

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}`;
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CriteriaView() {
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createLesson, setCreateLesson] = useState<MissingLesson | null>(null);
  const { toasts, push, remove } = useToast();

  const todayIso = isoToday();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/criteria", { cache: "no-store" });
      const text = await r.text();

      if (!r.ok || text.trim().startsWith("<")) {
        setError(`Ошибка API (${r.status})`);
        return;
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        setError("Ответ API не JSON");
        return;
      }

      setCriteria(data.criteria);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setEmpty(lesson: MissingLesson) {
    if (lesson.date < todayIso) {
      push("Нельзя проставить ДЗ задним числом", "err");
      return;
    }
    if (!lesson.student_ids.length) {
      push("Нет списка учеников", "err");
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

  async function updateAllKtp() {
    if (!confirm("Обновить все КТП? Это может занять 10–30 секунд.")) return;
    try {
      const r = await fetch("/api/ktp/update-all", { method: "POST" });
      const data = await r.json();
      if (!r.ok) {
        push("Ошибка: " + (data.detail || "неизвестно"), "err");
        return;
      }
      push(
        `Обновлено ${data.ok_count} из ${data.total} КТП`,
        data.failed?.length > 0 ? "err" : "ok"
      );
      load();
    } catch (e: any) {
      push("Ошибка: " + e.message, "err");
    }
  }

  if (loading && !criteria) {
    return (
      <div className="space-y-3 w-full">
        <Card className="w-full">
          <div className="py-8 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Загружаю данные...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 w-full">
        <Card className="w-full">
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-[13px]">
            {error}
          </div>
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={load}>
              Повторить
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!criteria) return null;

  const { period } = criteria;

  return (
    <div className="space-y-3 w-full">
      {/* ============ Верхняя плашка ============ */}
      <Card className="w-full !py-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-[15px] font-semibold text-slate-900">
                Критерии надбавки МЭШ
              </h2>
              {criteria.overall_passed ? (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                  ✓ Выполнены
                </span>
              ) : !criteria.overall_reachable ? (
                <span className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                  ✕ Недостижимы
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  ⚠ В процессе
                </span>
              )}
            </div>

            <div className="text-[12px] text-slate-500 mb-2">
              Период: <b>{formatDateShort(period.from)}</b> —{" "}
              <b>{formatDateShort(period.to)}</b> · всего уроков:{" "}
              <b>{criteria.total_lessons}</b>{" "}
              <span className="text-slate-400">
                (прошло: {criteria.total_past}, впереди: {criteria.total_future})
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span>
                <b className="text-slate-700">КТП</b> ≥ {criteria.ktp_target}%
                уроков привязаны к темам
              </span>
              <span>
                <b className="text-slate-700">ДЗ</b> ≥ {criteria.hw_target}%
                уроков имеют задание
              </span>
              <span className="text-amber-700">
                ⚠ Хотя бы один не выполнен → надбавка = 0
              </span>
            </div>
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
      </Card>

      {/* ============ Предупреждение о недостижимости ============ */}
      {!criteria.overall_reachable && (
        <div className="w-full rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="text-[20px] leading-none">⚠</span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-red-800 mb-0.5">
                В этом отчётном периоде надбавка недостижима
              </div>
              <div className="text-[12px] text-red-700 space-y-0.5">
                {!criteria.ktp_reachable && (
                  <div>
                    • <b>КТП:</b> даже если все будущие уроки привязать к темам,
                    максимум{" "}
                    <b>
                      {typeof criteria.ktp_max_percent === "number"
                        ? `${criteria.ktp_max_percent}%`
                        : "—"}
                    </b>{" "}
                    (нужно {criteria.ktp_target}%)
                  </div>
                )}
                {!criteria.hw_reachable && (
                  <div>
                    • <b>ДЗ:</b> даже если на все будущие уроки задать ДЗ,
                    максимум{" "}
                    <b>
                      {typeof criteria.hw_max_percent === "number"
                        ? `${criteria.hw_max_percent}%`
                        : "—"}
                    </b>{" "}
                    (нужно {criteria.hw_target}%)
                  </div>
                )}
                <div className="pt-1 text-red-600">
                  Догнать критерий невозможно — прошедшие уроки уже испортили
                  статистику. Надбавка за этот период <b>не будет начислена</b>.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ Две колонки ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full items-start">
        {/* --- ДЗ --- */}
        <Card className="w-full flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <CardTitle>Домашние задания</CardTitle>
            {criteria.hw_passed ? (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                ✓
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                ✕
              </span>
            )}
          </div>

          <ProgressBar
            current={criteria.hw_percent}
            target={criteria.hw_target}
            passed={criteria.hw_passed}
            maxPercent={criteria.hw_max_percent}
          />

          <div className="flex items-center justify-between text-[11px] text-slate-500 my-3">
            <span>
              сделано: <b className="text-slate-700">{criteria.hw_given}</b> из{" "}
              <b className="text-slate-700">{criteria.total_lessons}</b>
            </span>
            <span>
              не хватает:{" "}
              <b className={criteria.hw_missing > 0 ? "text-amber-700" : "text-slate-700"}>
                {criteria.hw_missing}
              </b>
            </span>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold text-slate-500">
              Проблемные уроки ({criteria.hw_missing_lessons.length})
            </div>
            <Link
              href="/dashboard/homework"
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
            >
              Все ДЗ →
            </Link>
          </div>

          <ProblemList
            lessons={criteria.hw_missing_lessons}
            todayIso={todayIso}
            actionType="homework"
            onSetEmpty={setEmpty}
            onCreate={(l) => setCreateLesson(l)}
          />
        </Card>

        {/* --- КТП --- */}
        <Card className="w-full flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <CardTitle>Покрытие уроков КТП</CardTitle>
            {criteria.ktp_passed ? (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                ✓
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                ✕
              </span>
            )}
          </div>

          <ProgressBar
            current={criteria.ktp_percent}
            target={criteria.ktp_target}
            passed={criteria.ktp_passed}
            maxPercent={criteria.ktp_max_percent}
          />

          <div className="flex items-center justify-between text-[11px] text-slate-500 my-3">
            <span>
              сделано: <b className="text-slate-700">{criteria.ktp_linked}</b> из{" "}
              <b className="text-slate-700">{criteria.total_lessons}</b>
            </span>
            <span>
              не хватает:{" "}
              <b className={criteria.ktp_missing > 0 ? "text-amber-700" : "text-slate-700"}>
                {criteria.ktp_missing}
              </b>
            </span>
          </div>

          {!criteria.ktp_passed && (
            <div className="mb-3">
              <Button
                size="sm"
                variant="primary"
                onClick={updateAllKtp}
                className="w-full"
              >
                Обновить все КТП
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold text-slate-500">
              Проблемные уроки ({criteria.ktp_missing_lessons.length})
            </div>
            <Link
              href="/dashboard/ktp"
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
            >
              Все КТП →
            </Link>
          </div>

          <ProblemList
            lessons={criteria.ktp_missing_lessons}
            todayIso={todayIso}
            actionType="ktp"
          />
        </Card>
      </div>

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

/* ============ Прогресс-бар ============ */

function ProgressBar({
  current,
  target,
  passed,
  maxPercent,
}: {
  current: number;
  target: number;
  passed: boolean;
  maxPercent?: number;
}) {
  const barColor = passed
    ? "bg-emerald-500"
    : current >= target * 0.7
    ? "bg-amber-500"
    : "bg-red-500";

  const isUnreachable = maxPercent !== undefined && maxPercent < target;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[22px] font-bold text-slate-800 leading-none">
          {current.toFixed(1)}%
        </span>
        <span className="text-[11px] text-slate-500">
          цель: <b>{target}%</b>
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, current)}%` }}
        />
        {isUnreachable && maxPercent !== undefined && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500"
            style={{ left: `${maxPercent}%` }}
            title={`Максимум достижимого: ${maxPercent}%`}
          />
        )}
      </div>
      {isUnreachable && maxPercent !== undefined && (
        <div className="text-[10px] text-red-600 mt-1">
          максимум достижимого: <b>{maxPercent}%</b>
        </div>
      )}
    </div>
  );
}

/* ============ Список проблемных уроков ============ */

function ProblemList({
  lessons,
  todayIso,
  actionType,
  onSetEmpty,
  onCreate,
}: {
  lessons: MissingLesson[];
  todayIso: string;
  actionType: "homework" | "ktp";
  onSetEmpty?: (l: MissingLesson) => void;
  onCreate?: (l: MissingLesson) => void;
}) {
  const sorted = [...lessons].sort((a, b) => {
    const aFuture = a.date >= todayIso;
    const bFuture = b.date >= todayIso;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    return a.date.localeCompare(b.date);
  });

  if (sorted.length === 0) {
    return (
      <div className="text-[11px] text-slate-400 italic py-3 text-center">
        Нет проблемных уроков
      </div>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200 -mx-1">
      <div className="divide-y divide-slate-100">
        {sorted.map((l, i) => {
          const past = l.date < todayIso;

          return (
            <div
              key={i}
              className={`flex items-center gap-2 px-2 py-1.5 text-[11px] ${
                past ? "opacity-60" : ""
              }`}
            >
              <span className="font-mono text-[10px] text-slate-500 w-10 shrink-0">
                {formatDateShort(l.date)}
              </span>
              <span className="font-mono text-[10px] text-slate-400 w-9 shrink-0">
                {l.time}
              </span>
              <span className="flex-1 text-slate-700 truncate">
                {l.group_name}
              </span>

              {actionType === "homework" && (
                <div className="shrink-0 flex items-center gap-1">
                  {past ? (
                    <span className="text-[10px] text-slate-400 italic">
                      прошло
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSetEmpty?.(l)}
                        className="text-[10px] text-amber-700 hover:text-amber-900 font-medium hover:underline whitespace-nowrap"
                      >
                        без ДЗ
                      </button>
                      <button
                        type="button"
                        onClick={() => onCreate?.(l)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-medium hover:underline whitespace-nowrap"
                      >
                        задать
                      </button>
                    </>
                  )}
                </div>
              )}

              {actionType === "ktp" && (
                <div className="shrink-0">
                  <span className="text-[10px] text-amber-600">нет КТП</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ Модалка создания ДЗ ============ */

function CreateModal({
  lesson,
  onClose,
  onSaved,
  toast,
}: {
  lesson: MissingLesson;
  onClose: () => void;
  onSaved: () => void;
  toast: (text: string, type?: "ok" | "err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");

  async function save() {
    if (!description.trim()) {
      toast("Введите текст ДЗ", "err");
      return;
    }
    if (!lesson.student_ids.length) {
      toast("Нет списка учеников", "err");
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
              {lesson.group_name}
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