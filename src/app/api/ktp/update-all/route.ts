// src/app/api/ktp/update-all/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fetchCurrentAcademicYear } from "@/lib/academic-year";

const CONCURRENCY = 3; // сколько планов обрабатывать параллельно

export async function POST() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
    }

    const tokenRow = await prisma.token.findFirst({
        where: { userId: user.id, isActive: true },
        orderBy: { grantedAt: "desc" },
    });

    if (!tokenRow || (tokenRow.expiresAt && tokenRow.expiresAt < new Date())) {
        return NextResponse.json(
            { detail: "Нет активного токена МЭШ" },
            { status: 403 }
        );
    }

    if (!user.profileId) {
        return NextResponse.json(
            { detail: "Не известен profile_id" },
            { status: 400 }
        );
    }

    const meshToken = tokenRow.token;
    const teacherId = Number(user.profileId);

    const headers = {
        authorization: `Bearer ${meshToken}`,
        "profile-id": String(teacherId),
        "x-mes-hostid": "9",
        "x-mes-roleid": "9",
        "x-mes-subsystem": "teacherweb",
        aid: "14",
        accept: "*/*",
    };

    try {
        // 1. Учебный год
        const academicYear = await fetchCurrentAcademicYear(meshToken, teacherId);

        // 2. Список групп из расписания
        const scheduleUrl = new URL(
            "https://school.mos.ru/api/ej/plan/teacher/v1/schedule_items"
        );
        scheduleUrl.searchParams.set("academic_year_id", String(academicYear.id));
        scheduleUrl.searchParams.set("teacher_id", String(teacherId));
        scheduleUrl.searchParams.set("from", academicYear.start_date);
        scheduleUrl.searchParams.set("to", academicYear.end_date);
        scheduleUrl.searchParams.set("with_group_class_subject_info", "true");
        scheduleUrl.searchParams.set("page", "1");
        scheduleUrl.searchParams.set("per_page", "4000");
        scheduleUrl.searchParams.set("original", "true");

        const schRes = await fetch(scheduleUrl.toString(), {
            headers: { ...headers, "x-mes-subsystem": "teacherweb" },
        });

        if (!schRes.ok) {
            return NextResponse.json(
                { detail: `Ошибка расписания: ${schRes.status}` },
                { status: schRes.status }
            );
        }

        const schData = await schRes.json();
        const items = Array.isArray(schData)
            ? schData
            : schData.items || schData.data || [];

        const groupIds = new Set<number>();
        for (const lesson of items) {
            if (lesson.cancelled) continue;
            if (lesson.teacher_id && Number(lesson.teacher_id) !== teacherId) continue;
            const gid = Number(lesson.group_id);
            if (gid) groupIds.add(gid);
        }

        if (groupIds.size === 0) {
            return NextResponse.json({
                ok: true,
                message: "Групп не найдено",
                total: 0,
                ok_count: 0,
                failed: [],
            });
        }

        // 3. Список КТП для этих групп
        const plansUrl = new URL(
            "https://school.mos.ru/api/ej/plan/teacher/v1/calendar_plans"
        );
        plansUrl.searchParams.set("academic_year_id", String(academicYear.id));
        plansUrl.searchParams.set("group_id", [...groupIds].join(","));

        const plansRes = await fetch(plansUrl.toString(), {
            headers: { ...headers, "x-mes-subsystem": "ppktpw" },
        });

        if (!plansRes.ok) {
            return NextResponse.json(
                { detail: `Ошибка списка КТП: ${plansRes.status}` },
                { status: plansRes.status }
            );
        }

        const plansData = await plansRes.json();
        const plans = Array.isArray(plansData)
            ? plansData
            : plansData.items || plansData.data || [];

        const planIds: number[] = plans
            .map((p: any) => Number(p.id))
            .filter((id: number) => !!id);

        // 4. Для каждого плана: finish + recalc
        const results: {
            plan_id: number;
            group_name?: string;
            finish_ok: boolean;
            recalc_ok: boolean;
            error?: string;
        }[] = [];

        for (let i = 0; i < planIds.length; i += CONCURRENCY) {
            const chunk = planIds.slice(i, i + CONCURRENCY);
            const chunkResults = await Promise.all(
                chunk.map(async (pid) => {
                    const groupName =
                        plans.find((p: any) => Number(p.id) === pid)?.group_name || "";

                    let finishOk = false;
                    let recalcOk = false;
                    let error: string | undefined;

                    try {
                        // finish
                        const fRes = await fetch(
                            `https://school.mos.ru/api/ej/plan/teacher/v1/calendar_plans/${pid}/finish?ignore_IA=true`,
                            { method: "POST", headers }
                        );
                        finishOk = fRes.ok;
                        if (!fRes.ok) {
                            const t = await fRes.text();
                            error = `finish ${fRes.status}: ${t.slice(0, 100)}`;
                        }

                        // recalc (только если finish прошёл)
                        if (finishOk) {
                            const rRes = await fetch(
                                `https://school.mos.ru/api/ej/plan/teacher/v1/calendar_plans/${pid}/recalc?ignore_IA=true`,
                                { method: "POST", headers }
                            );
                            recalcOk = rRes.ok;
                            if (!rRes.ok) {
                                const t = await rRes.text();
                                error = `recalc ${rRes.status}: ${t.slice(0, 100)}`;
                            }
                        }
                    } catch (e: any) {
                        error = e.message || "unknown";
                    }

                    return {
                        plan_id: pid,
                        group_name: groupName,
                        finish_ok: finishOk,
                        recalc_ok: recalcOk,
                        error,
                    };
                })
            );
            results.push(...chunkResults);
        }

        const okCount = results.filter((r) => r.finish_ok && r.recalc_ok).length;
        const failed = results.filter((r) => !(r.finish_ok && r.recalc_ok));

        // Лог
        await prisma.logEntry.create({
            data: {
                userId: user.id,
                action: "KTP_UPDATE_ALL",
                details: `total=${planIds.length} ok=${okCount} failed=${failed.length}`,
            },
        });

        return NextResponse.json({
            ok: true,
            message: `Обновлено ${okCount} из ${planIds.length} КТП`,
            total: planIds.length,
            ok_count: okCount,
            failed,
        });
    } catch (e: any) {
        console.error("[ktp/update-all] error:", e);
        return NextResponse.json(
            { detail: e.message || "Ошибка запроса" },
            { status: 500 }
        );
    }
}