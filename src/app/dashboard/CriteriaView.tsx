// src/app/dashboard/CriteriaView.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

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

  hw_given: number;
  hw_missing: number;
  hw_percent: number;
  hw_max_percent: number;
  hw_target: number;
  hw_passed: boolean;
  hw_reachable: boolean;

  launch_done: number;
  launch_missing: number;
  launch_percent: number;
  launch_max_percent: number;
  launch_target: number;
  launch_passed: boolean;
  launch_reachable: boolean;

  overall_passed: boolean;
  overall_reachable: boolean;
};

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}`;
}

// Сколько ещё нужно сделать, чтобы достичь цели
function neededToTarget(
  total: number,
  target: number,
  done: number
): number {
  const required = Math.ceil(total * (target / 100));
  return Math.max(0, required - done);
}

export function CriteriaView() {
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

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
  const canEarn = criteria.overall_reachable && !criteria.overall_passed;

  // Сколько нужно до цели по каждому критерию
  const hwNeeded = neededToTarget(
    criteria.total_lessons,
    criteria.hw_target,
    criteria.hw_given
  );
  const ktpNeeded = neededToTarget(
    criteria.total_lessons,
    criteria.ktp_target,
    criteria.ktp_linked
  );
  const launchNeeded = neededToTarget(
    criteria.total_lessons,
    criteria.launch_target,
    criteria.launch_done
  );

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
              <span>
                <b className="text-slate-700">Запуск</b> ≥{" "}
                {criteria.launch_target}% уроков запущены
              </span>
              <span className="text-amber-700">
                ⚠ Хотя бы один не выполнен → надбавка = 0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap shrink-0">
            {canEarn && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300">
                <span className="text-[16px] leading-none">💰</span>
                <div className="leading-tight">
                  <div className="text-[12px] font-semibold text-emerald-800">
                    Ещё можно получить 5000 ₽
                  </div>
                  <div className="text-[10px] text-emerald-600">
                    исправьте недоработки ниже
                  </div>
                </div>
              </div>
            )}

            <Button
              size="sm"
              variant="secondary"
              onClick={load}
              disabled={loading}
            >
              {loading ? "..." : "Обновить"}
            </Button>
          </div>
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
                {!criteria.launch_reachable && (
                  <div>
                    • <b>Запуск:</b> даже если запустить все будущие уроки,
                    максимум{" "}
                    <b>
                      {typeof criteria.launch_max_percent === "number"
                        ? `${criteria.launch_max_percent}%`
                        : "—"}
                    </b>{" "}
                    (нужно {criteria.launch_target}%)
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

      {/* ============ Три колонки ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 w-full items-start">
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

          <div className="my-3 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                сделано: <b className="text-slate-700">{criteria.hw_given}</b> из{" "}
                <b className="text-slate-700">{criteria.total_lessons}</b>
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                до цели:{" "}
                <b
                  className={
                    hwNeeded > 0 ? "text-amber-700" : "text-emerald-600"
                  }
                >
                  {hwNeeded}
                </b>
              </span>
              <span className="text-slate-400">
                всего без ДЗ: <b className="text-slate-600">{criteria.hw_missing}</b>
              </span>
            </div>
          </div>

          <div className="mt-auto pt-2 border-t border-slate-100">
            <Link
              href="/dashboard/homework"
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
            >
              Перейти к домашним заданиям →
            </Link>
          </div>
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

          <div className="my-3 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                сделано: <b className="text-slate-700">{criteria.ktp_linked}</b>{" "}
                из <b className="text-slate-700">{criteria.total_lessons}</b>
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                до цели:{" "}
                <b
                  className={
                    ktpNeeded > 0 ? "text-amber-700" : "text-emerald-600"
                  }
                >
                  {ktpNeeded}
                </b>
              </span>
              <span className="text-slate-400">
                всего без КТП:{" "}
                <b className="text-slate-600">{criteria.ktp_missing}</b>
              </span>
            </div>
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

          <div className="mt-auto pt-2 border-t border-slate-100">
            <Link
              href="/dashboard/ktp"
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
            >
              Перейти к КТП →
            </Link>
          </div>
        </Card>

        {/* --- Запуск уроков --- */}
        <Card className="w-full flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <CardTitle>Запуск уроков</CardTitle>
            {criteria.launch_passed ? (
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
            current={criteria.launch_percent}
            target={criteria.launch_target}
            passed={criteria.launch_passed}
            maxPercent={criteria.launch_max_percent}
          />

          <div className="my-3 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                запущено:{" "}
                <b className="text-slate-700">{criteria.launch_done}</b> из{" "}
                <b className="text-slate-700">{criteria.total_lessons}</b>
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                до цели:{" "}
                <b
                  className={
                    launchNeeded > 0 ? "text-amber-700" : "text-emerald-600"
                  }
                >
                  {launchNeeded}
                </b>
              </span>
              <span className="text-slate-400">
                всего не запущено:{" "}
                <b className="text-slate-600">{criteria.launch_missing}</b>
              </span>
            </div>
          </div>

          <div className="mt-auto pt-2 border-t border-slate-100">
            <Link
              href="/dashboard/launch"
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
            >
              Перейти к плану запуска →
            </Link>
          </div>
        </Card>
      </div>
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