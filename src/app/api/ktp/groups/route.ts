// src/app/api/ktp/groups/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fetchCurrentAcademicYear } from "@/lib/academic-year";

type GroupSummary = {
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

export async function GET() {
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
        aid: "14",
        accept: "*/*",
    };

    try {
        // ============ 0. Учебный год ============
        const academicYear = await fetchCurrentAcademicYear(meshToken, teacherId);

        // ============ 1. Расписание ============
        const scheduleUrl = new URL(
            "https://school.mos.ru/api/ej/plan/teacher/v1/schedule_items"
        );
        scheduleUrl.searchParams.set("academic_year_id", String(academicYear.id));
        scheduleUrl.searchParams.set("teacher_id", String(teacherId));
        scheduleUrl.searchParams.set("from", academicYear.start_date);
        scheduleUrl.searchParams.set("to", academicYear.end_date);
        scheduleUrl.searchParams.set("with_group_class_subject_info", "true");
        scheduleUrl.searchParams.set("with_lesson_info", "true");
        scheduleUrl.searchParams.set("page", "1");
        scheduleUrl.searchParams.set("per_page", "4000");
        scheduleUrl.searchParams.set("original", "true");

        const schRes = await fetch(scheduleUrl.toString(), {
            headers: { ...headers, "x-mes-subsystem": "teacherweb" },
        });

        if (!schRes.ok) {
            const text = await schRes.text();
            return NextResponse.json(
                {
                    detail: `Ошибка расписания: ${schRes.status}`,
                    raw: text.slice(0, 300),
                },
                { status: schRes.status }
            );
        }

        const schData = await schRes.json();
        const items = Array.isArray(schData)
            ? schData
            : schData.items || schData.data || [];

        // Группы из расписания
        const groupsMap = new Map<number, GroupSummary>();
        for (const lesson of items) {
            if (lesson.cancelled) continue;
            if (lesson.teacher_id && Number(lesson.teacher_id) !== teacherId) continue;
            if (lesson.replaced) {
                const replacedId = lesson.replaced_teacher_id;
                if (replacedId && Number(replacedId) !== teacherId) continue;
            }

            const gid = Number(lesson.group_id);
            if (!gid) continue;

            if (!groupsMap.has(gid)) {
                groupsMap.set(gid, {
                    group_id: gid,
                    group_name: lesson.group_name || "",
                    class_unit_name: lesson.class_unit_name || "",
                    subject_name: lesson.subject_name || "",
                    lesson_count: 0,
                    plan_id: null,
                    plan_topics_total: 0,
                    plan_topics_with_date: 0,
                    plan_topics_without_date: 0,
                    has_issues: false,
                });
            }
            groupsMap.get(gid)!.lesson_count += 1;
        }

        const groupIds = [...groupsMap.keys()];
        if (groupIds.length === 0) {
            return NextResponse.json({ ok: true, academicYear, groups: [] });
        }

        // ============ 2. КТП для всех групп ============
        const plansUrl = new URL(
            "https://school.mos.ru/api/ej/plan/teacher/v1/calendar_plans"
        );
        plansUrl.searchParams.set("academic_year_id", String(academicYear.id));
        plansUrl.searchParams.set("group_id", groupIds.join(","));

        const plansRes = await fetch(plansUrl.toString(), {
            headers: { ...headers, "x-mes-subsystem": "ppktpw" },
        });

        if (!plansRes.ok) {
            const groups: GroupSummary[] = [...groupsMap.values()];
            return NextResponse.json({ ok: true, academicYear, groups });
        }

        const plansData = await plansRes.json();
        const plans = Array.isArray(plansData)
            ? plansData
            : plansData.items || plansData.data || [];

        for (const plan of plans) {
            const gid = Number(plan.group_id);
            if (!gid) continue;
            if (groupsMap.has(gid)) {
                groupsMap.get(gid)!.plan_id = plan.id;
            }
        }

        // ============ 3. Детали каждого КТП ============
        const planIds = [...groupsMap.values()]
            .filter((g) => g.plan_id)
            .map((g) => g.plan_id!);

        const detailsMap = new Map<
            number,
            { total: number; withDate: number; withoutDate: number }
        >();

        const chunkSize = 5;
        for (let i = 0; i < planIds.length; i += chunkSize) {
            const chunk = planIds.slice(i, i + chunkSize);
            const results = await Promise.all(
                chunk.map(async (pid) => {
                    try {
                        const r = await fetch(
                            `https://school.mos.ru/api/ej/plan/teacher/v1/calendar_plans/${pid}`,
                            { headers: { ...headers, "x-mes-subsystem": "ppktpw" } }
                        );
                        if (!r.ok) return { pid, total: 0, withDate: 0, withoutDate: 0 };
                        const d = await r.json();
                        return { pid, ...countTopics(d) };
                    } catch {
                        return { pid, total: 0, withDate: 0, withoutDate: 0 };
                    }
                })
            );
            for (const res of results) {
                detailsMap.set(res.pid, {
                    total: res.total,
                    withDate: res.withDate,
                    withoutDate: res.withoutDate,
                });
            }
        }

        // ============ 4. Итог ============
        const groups: GroupSummary[] = [];
        for (const g of groupsMap.values()) {
            if (g.plan_id && detailsMap.has(g.plan_id)) {
                const d = detailsMap.get(g.plan_id)!;
                g.plan_topics_total = d.total;
                g.plan_topics_with_date = d.withDate;
                g.plan_topics_without_date = d.withoutDate;
            }

            // Проблема: уроков в расписании больше, чем тем с датой в КТП
            g.has_issues = g.lesson_count > g.plan_topics_with_date;

            groups.push(g);
        }

        return NextResponse.json({ ok: true, academicYear, groups });
    } catch (e: any) {
        console.error("[ktp] error:", e);
        return NextResponse.json(
            { detail: e.message || "Ошибка запроса" },
            { status: 500 }
        );
    }
}

function countTopics(planData: any): {
    total: number;
    withDate: number;
    withoutDate: number;
} {
    const lessons: any[] = Array.isArray(planData.lessons)
        ? planData.lessons
        : [];

    if (!lessons.length) return { total: 0, withDate: 0, withoutDate: 0 };

    let withDate = 0;
    let withoutDate = 0;

    for (const l of lessons) {
        if (l.date) withDate++;
        else withoutDate++;
    }

    return { total: withDate + withoutDate, withDate, withoutDate };
}