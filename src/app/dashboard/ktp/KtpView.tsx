// src/app/dashboard/ktp/KtpView.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast, ToastContainer } from "@/components/ui/Toast";

type Group = {
    group_id: number;
    group_name: string;
    class_unit_name: string;
    subject_name: string;
    lesson_count: number;
    plan_id: number | null;
    plan_topics_total: number;
    plan_topics_with_date: number;
    plan_topics_without_date: number;
    has_issues: boolean;
};

export function KtpView() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toasts, push, remove } = useToast();

    async function loadGroups() {
        setLoading(true);
        setError(null);
        try {
            const r = await fetch("/api/ktp/groups", { cache: "no-store" });
            const data = await r.json();
            if (!r.ok) {
                setError(data.detail || "Ошибка загрузки групп");
                return;
            }
            setGroups(data.groups || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function updateAll() {
        if (updating) return;
        setUpdating(true);
        try {
            const r = await fetch("/api/ktp/update-all", { method: "POST" });
            const data = await r.json();

            if (!r.ok) {
                push("Ошибка: " + (data.detail || "неизвестно"), "err");
                return;
            }

            if (data.failed && data.failed.length > 0) {
                push(
                    `Обновлено ${data.ok_count} из ${data.total}. С ошибками: ${data.failed.length}`,
                    "err"
                );
            } else {
                push(data.message || "Все КТП обновлены", "ok");
            }

            await loadGroups();
        } catch (e: any) {
            push("Ошибка: " + e.message, "err");
        } finally {
            setUpdating(false);
        }
    }

    useEffect(() => {
        loadGroups();
    }, []);

    return (
        <div className="space-y-3 w-full">
            <Card className="w-full">
                <div className="flex items-center justify-between">
                    <CardTitle>Мои группы и КТП</CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={loadGroups}
                            disabled={loading || updating}
                        >
                            {loading ? "Загружаю..." : "Обновить данные"}
                        </Button>
                        <Button
                            size="sm"
                            variant="primary"
                            onClick={updateAll}
                            disabled={updating || loading}
                        >
                            {updating ? "Обновляю все КТП..." : "Обновить все КТП"}
                        </Button>
                    </div>
                </div>
            </Card>

            {error && (
                <Card className="w-full">
                    <div className="text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-[13px]">
                        {error}
                    </div>
                </Card>
            )}

            {loading && groups.length === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 w-full items-start">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            )}

            {groups.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 w-full items-start">
                    {groups.map((g) => (
                        <GroupCard
                            key={g.group_id}
                            group={g}
                            onRefresh={loadGroups}
                            toast={push}
                        />
                    ))}
                </div>
            )}

            {groups.length === 0 && !loading && !error && (
                <Card className="w-full">
                    <p className="text-slate-400 text-[13px] text-center py-6">
                        Группы не найдены. Проверьте токен МЭШ.
                    </p>
                </Card>
            )}

            <ToastContainer toasts={toasts} onRemove={remove} />
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className="self-start rounded-lg border border-slate-200 bg-white shadow-sm flex flex-col animate-pulse">
            <div className="px-3 py-2 space-y-2">
                <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                <div className="h-2.5 bg-slate-100 rounded w-1/2" />
            </div>
            <div className="px-3 py-2 border-t border-slate-100">
                <div className="h-7 bg-slate-100 rounded w-full" />
            </div>
        </div>
    );
}

function GroupCard({
    group,
    onRefresh,
    toast,
}: {
    group: Group;
    onRefresh: () => void;
    toast: (text: string, type?: "ok" | "err") => void;
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const planId = group.plan_id;
    const hasPlan = planId !== null;

    // Сколько уроков в расписании не покрыто темами КТП
    const uncovered = Math.max(
        0,
        group.lesson_count - group.plan_topics_with_date
    );

    let statusText = "";
    let statusColor = "text-slate-500";

    if (!hasPlan) {
        statusText = "КТП не создано";
        statusColor = "text-slate-500";
    } else if (uncovered > 0) {
        statusText = `${uncovered} без темы`;
        statusColor = "text-amber-600";
    } else if (group.plan_topics_total > 0) {
        statusText = "всё привязано";
        statusColor = "text-emerald-600";
    } else {
        statusText = "нет тем";
        statusColor = "text-slate-500";
    }

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open]);

    async function updateKtp() {
        if (!planId) {
            toast("Нет КТП", "err");
            return;
        }
        setBusy(true);
        try {
            const r = await fetch(`/api/ktp/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan_id: planId }),
            });
            const data = await r.json();
            if (!r.ok) {
                toast("Ошибка: " + (data.detail || "неизвестно"), "err");
                return;
            }
            toast(data.message || "КТП обновлено", "ok");
            setTimeout(onRefresh, 1000);
        } catch (e: any) {
            toast("Ошибка: " + e.message, "err");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div
            ref={containerRef}
            className={`relative self-start rounded-lg border bg-white shadow-sm flex flex-col ${group.has_issues ? "border-amber-400" : "border-slate-200"
                } ${open ? "z-20" : "z-10"}`}
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-left px-3 py-2 hover:bg-slate-50 transition flex items-start gap-2 rounded-t-lg"
            >
                <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-800 truncate">
                        {group.group_name ||
                            group.class_unit_name ||
                            `Группа ${group.group_id}`}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                        <span className="text-slate-500">{group.lesson_count} ур.</span>
                        <span className="text-slate-300">·</span>
                        <span className={statusColor}>{statusText}</span>
                    </div>
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 shrink-0">
                    {open ? "▴" : "▾"}
                </span>
            </button>

            {open && (
                <div
                    className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-slate-200 bg-white shadow-xl px-3 py-2.5 space-y-1.5"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Row
                        label="Уроков в расписании"
                        value={String(group.lesson_count)}
                    />
                    <Row label="Тем в КТП" value={String(group.plan_topics_total)} />
                    <Row
                        label="Тем с датой"
                        value={String(group.plan_topics_with_date)}
                        highlight={
                            group.plan_topics_with_date > 0 ? "emerald" : undefined
                        }
                    />
                    <Row
                        label="Тем без даты"
                        value={String(group.plan_topics_without_date)}
                        highlight={
                            group.plan_topics_without_date > 0 ? "amber" : undefined
                        }
                    />
                    {planId && <Row label="ID плана" value={`#${planId}`} />}

                    {uncovered > 0 && (
                        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-1.5">
                            {uncovered} урок(ов) в расписании без темы
                        </div>
                    )}
                    {uncovered === 0 && planId && group.plan_topics_total > 0 && (
                        <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 mt-1.5">
                            Все уроки привязаны к темам
                        </div>
                    )}
                    {!planId && (
                        <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 mt-1.5">
                            КТП не создано в МЭШ
                        </div>
                    )}
                </div>
            )}

            <div className="px-3 py-2 border-t border-slate-100 mt-auto">
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={updateKtp}
                    disabled={busy || !planId}
                    className="w-full"
                >
                    {busy ? "Обновляю..." : "Обновить КТП"}
                </Button>
            </div>
        </div>
    );
}

function Row({
    label,
    value,
    highlight,
}: {
    label: string;
    value: string;
    highlight?: "emerald" | "amber" | "red";
}) {
    const colorClass =
        highlight === "emerald"
            ? "text-emerald-600"
            : highlight === "amber"
                ? "text-amber-600"
                : highlight === "red"
                    ? "text-red-600"
                    : "text-slate-800";

    return (
        <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-500">{label}</span>
            <span className={`font-medium ${colorClass}`}>{value}</span>
        </div>
    );
}