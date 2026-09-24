// src/app/api/schedule/plan/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fetchCurrentAcademicYear } from "@/lib/academic-year";

// ------------------------------------------------------------
// POST — создать/обновить план (isActive сбрасывается в false)
// ------------------------------------------------------------
export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
    }

    const tokenRow = await prisma.token.findFirst({
        where: { userId: user.id, isActive: true },
        orderBy: { grantedAt: "desc" },
    });

    if (!tokenRow || (tokenRow.expiresAt && tokenRow.expiresAt < new Date())) {
        return NextResponse.json({ detail: "Нет активного токена МЭШ" }, { status: 403 });
    }

    if (!user.profileId) {
        return NextResponse.json({ detail: "Нет profile_id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const dateFrom = String(body.from || "").trim();
    const dateTo = String(body.to || "").trim();

    if (!dateFrom || !dateTo) {
        return NextResponse.json({ detail: "Нужны from и to" }, { status: 400 });
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
        const academicYear = await fetchCurrentAcademicYear(meshToken, teacherId);

        // Запрашиваем расписание
        const url = new URL("https://school.mos.ru/api/ej/plan/teacher/v1/schedule_items");
        url.searchParams.set("academic_year_id", String(academicYear.id));
        url.searchParams.set("teacher_id", String(teacherId));
        url.searchParams.set("from", dateFrom);
        url.searchParams.set("to", dateTo);
        url.searchParams.set("with_group_class_subject_info", "true");
        url.searchParams.set("with_lesson_info", "true");
        url.searchParams.set("with_course_calendar_info", "true");
        url.searchParams.set("page", "1");
        url.searchParams.set("per_page", "2000");
        url.searchParams.set("original", "true");

        const r = await fetch(url.toString(), { headers, cache: "no-store" });
        if (!r.ok) {
            const text = await r.text();
            return NextResponse.json(
                { detail: `Ошибка МЭШ: ${r.status}`, raw: text.slice(0, 300) },
                { status: r.status }
            );
        }

        const data = await r.json();
        const items = Array.isArray(data) ? data : data.items || data.data || [];

        // Собираем уроки + script_uuid
        const rawLessons: Array<{
            date: string;
            time: string;
            startAt: Date;
            groupId: number;
            groupName: string;
            subjectId: number;
            subjectName: string;
            lessonName: string;
            scriptUuid: string | null;
        }> = [];

        for (const lesson of items) {
            if (lesson.cancelled) continue;
            if (lesson.teacher_id && Number(lesson.teacher_id) !== teacherId) continue;
            if (lesson.replaced) {
                const rid = lesson.replaced_teacher_id;
                if (rid && Number(rid) !== teacherId) continue;
            }

            const d = lesson.date;
            if (!Array.isArray(d)) continue;
            const dateIso = `${d[0]}-${String(d[1]).padStart(2, "0")}-${String(d[2]).padStart(2, "0")}`;

            const t = lesson.time || [];
            if (!Array.isArray(t) || t.length < 2) continue;
            const timeStr = `${String(t[0]).padStart(2, "0")}:${String(t[1]).padStart(2, "0")}`;
            const startAt = new Date(`${dateIso}T${timeStr}:00`);

            // Извлекаем script_uuid
            let scriptUuid: string | null = null;
            if (Array.isArray(lesson.scripts_new) && lesson.scripts_new.length > 0) {
                scriptUuid = lesson.scripts_new[0].uuid || null;
            } else if (lesson.scripts && typeof lesson.scripts === "string") {
                try {
                    const parsed = JSON.parse(lesson.scripts);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        scriptUuid = parsed[0].uuid || null;
                    }
                } catch { }
            }

            rawLessons.push({
                date: dateIso,
                time: timeStr,
                startAt,
                groupId: Number(lesson.group_id),
                groupName: lesson.group_name || lesson.class_unit_name || "",
                subjectId: Number(lesson.subject_id) || 0,
                subjectName: lesson.subject_name || "",
                lessonName: lesson.lesson_name || "",
                scriptUuid,
            });
        }

        if (rawLessons.length === 0) {
            return NextResponse.json(
                { detail: "Нет уроков в указанном диапазоне" },
                { status: 400 }
            );
        }

        // ============ Резолвим script_uuid → original_uuid (bulk) ============
        const uuidsToResolve = new Set<string>();
        for (const l of rawLessons) {
            if (l.scriptUuid) uuidsToResolve.add(l.scriptUuid);
        }

        const materials: Record<string, { original_uuid: string; name: string }> = {};

        if (uuidsToResolve.size > 0) {
            const uuidsArr = [...uuidsToResolve];
            const CHUNK = 50;

            for (let i = 0; i < uuidsArr.length; i += CHUNK) {
                const chunk = uuidsArr.slice(i, i + CHUNK);
                try {
                    const br = await fetch(
                        "https://school.mos.ru/api/materials/v3/materials/bulk/uuids",
                        {
                            method: "POST",
                            headers: {
                                authorization: `Bearer ${meshToken}`,
                                "content-type": "application/json",
                                "profile-id": String(teacherId),
                                "x-mes-hostid": "9",
                                "x-mes-roleid": "9",
                                "x-mes-subsystem": "teacherweb",
                                aid: "14",
                                accept: "*/*",
                            },
                            body: JSON.stringify(chunk),
                        }
                    );

                    if (br.ok) {
                        const bulkData = await br.json();
                        const list = Array.isArray(bulkData)
                            ? bulkData
                            : bulkData.items || bulkData.data || [];

                        for (const m of list) {
                            if (!m.uuid || !m.original_uuid) continue;
                            materials[m.uuid] = {
                                original_uuid: String(m.original_uuid),
                                name: String(m.name || ""),
                            };
                        }
                    } else {
                        console.warn(`[plan] bulk/uuids failed: ${br.status}`);
                    }
                } catch (e) {
                    console.warn("[plan] bulk materials error:", e);
                }
            }
        }

        // ============ Собираем финальные уроки с launchUrl ============
        const lessons = rawLessons.map((l) => {
            const materialUuid = l.scriptUuid
                ? materials[l.scriptUuid]?.original_uuid || null
                : null;

            let launchUrl = "";
            if (materialUuid) {
                const activityUrl = `https://uchebnik.mos.ru/cms/materials/${materialUuid}/launch?teacher_id=${teacherId}&subject_id=${l.subjectId}&group_id=${l.groupId}&mode=management`;
                launchUrl = `https://school.mos.ru/api/launcher/v1/launch?activity_url=${encodeURIComponent(activityUrl)}`;
            }

            return {
                date: l.date,
                time: l.time,
                startAt: l.startAt,
                groupId: l.groupId,
                groupName: l.groupName,
                subjectId: l.subjectId,
                subjectName: l.subjectName,
                lessonName: l.lessonName,
                lessonTemplateId: null,
                launchUrl,
            };
        });

        // ============ Транзакция: пересоздаём план, isActive = false ============
        const result = await prisma.$transaction(async (tx) => {
            await tx.lessonPlan.deleteMany({ where: { userId: user.id } });

            const plan = await tx.lessonPlan.create({
                data: {
                    userId: user.id,
                    isActive: false,
                },
            });

            await tx.plannedLesson.createMany({
                data: lessons.map((l) => ({
                    planId: plan.id,
                    date: l.date,
                    time: l.time,
                    startAt: l.startAt,
                    groupId: l.groupId,
                    groupName: l.groupName,
                    subjectId: l.subjectId,
                    subjectName: l.subjectName,
                    lessonName: l.lessonName,
                    lessonTemplateId: l.lessonTemplateId,
                    launchUrl: l.launchUrl,
                    status: "pending",
                })),
            });

            return plan;
        });

        return NextResponse.json({
            ok: true,
            planId: result.id,
            lessonsCount: lessons.length,
        });
    } catch (e: any) {
        console.error("[schedule/plan] error:", e);
        return NextResponse.json({ detail: e.message }, { status: 500 });
    }
}

// ------------------------------------------------------------
// GET — статус плана
// ------------------------------------------------------------
export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
    }

    const plan = await prisma.lessonPlan.findUnique({
        where: { userId: user.id },
        include: {
            lessons: { orderBy: { startAt: "asc" } },
        },
    });

    if (!plan) {
        return NextResponse.json({ ok: true, active: false, plan: null });
    }

    const stats = {
        total: plan.lessons.length,
        pending: plan.lessons.filter((l) => l.status === "pending").length,
        running: plan.lessons.filter((l) => l.status === "running").length,
        finished: plan.lessons.filter((l) => l.status === "finished").length,
        failed: plan.lessons.filter((l) => l.status === "failed").length,
    };

    return NextResponse.json({
        ok: true,
        active: plan.isActive,
        planId: plan.id,
        stats,
        lessons: plan.lessons,
    });
}

// ------------------------------------------------------------
// DELETE — остановить план (isActive = false)
// ------------------------------------------------------------
export async function DELETE() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
    }

    await prisma.lessonPlan.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
    });

    return NextResponse.json({ ok: true });
}