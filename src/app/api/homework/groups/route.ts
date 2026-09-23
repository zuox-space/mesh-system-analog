// src/app/api/homework/groups/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fetchCurrentAcademicYear } from "@/lib/academic-year";

export async function GET(req: Request) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
    }

    const tokenRow = await prisma.token.findFirst({
        where: { userId: user.id, isActive: true },
        orderBy: { grantedAt: "desc" },
    });

    if (!tokenRow || (tokenRow.expiresAt && tokenRow.expiresAt < new Date())) {
        return NextResponse.json({ detail: "Нет токена МЭШ" }, { status: 403 });
    }

    if (!user.profileId) {
        return NextResponse.json({ detail: "Нет profile_id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const dateFrom =
        searchParams.get("from") || new Date().toISOString().slice(0, 10);
    const dateTo =
        searchParams.get("to") ||
        new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

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

        const url = new URL(
            "https://school.mos.ru/api/ej/plan/teacher/v1/schedule_items"
        );
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

        // Группируем по группам
        const groupsMap = new Map<
            number,
            {
                group_id: number;
                group_name: string;
                class_unit_name: string;
                subject_id: number;
                subject_name: string;
                student_ids: number[];
                lessons: any[];
            }
        >();

        for (const lesson of items) {
            if (lesson.cancelled) continue;
            if (lesson.teacher_id && Number(lesson.teacher_id) !== teacherId) continue;
            if (lesson.replaced) {
                const rid = lesson.replaced_teacher_id;
                if (rid && Number(rid) !== teacherId) continue;
            }

            const gid = Number(lesson.group_id);
            if (!gid) continue;

            if (!groupsMap.has(gid)) {
                groupsMap.set(gid, {
                    group_id: gid,
                    group_name: lesson.group_name || "",
                    class_unit_name: lesson.class_unit_name || "",
                    subject_id: Number(lesson.subject_id),
                    subject_name: lesson.subject_name || "",
                    student_ids: [],
                    lessons: [],
                });
            }

            const g = groupsMap.get(gid)!;

            // Дата
            const d = lesson.date;
            const dateIso = Array.isArray(d)
                ? `${d[0]}-${String(d[1]).padStart(2, "0")}-${String(d[2]).padStart(2, "0")}`
                : null;

            // Время
            const t = lesson.time || [];
            const timeStr =
                Array.isArray(t) && t.length >= 2
                    ? `${String(t[0]).padStart(2, "0")}:${String(t[1]).padStart(2, "0")}`
                    : "";

            // ДЗ: считаем урок "занятым", если есть хоть что-то
            const toGive = Array.isArray(lesson.homeworks_to_give)
                ? lesson.homeworks_to_give
                : [];
            const toVerify = Array.isArray(lesson.homeworks_to_verify)
                ? lesson.homeworks_to_verify
                : [];

            const hasToGive = toGive.length > 0;
            const hasToVerify = toVerify.length > 0;
            const hasHomework = hasToGive || hasToVerify;

            // ID ДЗ: приоритет у "выдать"
            const homeworkId = hasToGive
                ? Number(toGive[0].id)
                : hasToVerify
                    ? Number(toVerify[0].id)
                    : null;

            g.lessons.push({
                id: lesson.id,
                date: dateIso,
                time: timeStr,
                study_ordinal: lesson.study_ordinal,
                lesson_name: lesson.lesson_name || "",
                room_name: lesson.room_name || "",
                has_homework: hasHomework,
                has_to_give: hasToGive,
                has_to_verify: hasToVerify,
                homework_id: homeworkId,
                homework_text: "", // заполним ниже
                class_unit_id: Number(lesson.class_unit_id),
            });
        }

        // ============ Подтягиваем учеников каждой группы ============
        const CONCURRENCY = 5;
        const groupList = [...groupsMap.values()];

        for (let i = 0; i < groupList.length; i += CONCURRENCY) {
            const chunk = groupList.slice(i, i + CONCURRENCY);

            await Promise.all(
                chunk.map(async (g) => {
                    const sampleLesson = g.lessons.find((l) => l.class_unit_id);
                    const classUnitId = sampleLesson?.class_unit_id;

                    if (!classUnitId) {
                        console.warn(
                            `[homework/groups] нет class_unit_id для группы ${g.group_id}`
                        );
                        return;
                    }

                    try {
                        const studentsUrl = new URL(
                            "https://school.mos.ru/api/ej/core/teacher/v1/student_profiles"
                        );
                        studentsUrl.searchParams.set(
                            "academic_year_id",
                            String(academicYear.id)
                        );
                        studentsUrl.searchParams.set(
                            "class_unit_ids",
                            String(classUnitId)
                        );
                        studentsUrl.searchParams.set("group_ids", String(g.group_id));
                        studentsUrl.searchParams.set("with_groups", "true");
                        studentsUrl.searchParams.set("with_deleted", "false");
                        studentsUrl.searchParams.set("with_archived_groups", "false");
                        studentsUrl.searchParams.set("with_transferred", "false");
                        studentsUrl.searchParams.set("per_page", "150");
                        studentsUrl.searchParams.set("page", "1");

                        const studentsRes = await fetch(studentsUrl.toString(), {
                            headers: { ...headers, "x-mes-subsystem": "journalw" },
                        });

                        if (!studentsRes.ok) {
                            console.warn(
                                `[homework/groups] student_profiles ${g.group_id}: ${studentsRes.status}`
                            );
                            return;
                        }

                        const sData = await studentsRes.json();
                        const sList = Array.isArray(sData)
                            ? sData
                            : sData.items || sData.data || [];

                        const sids: number[] = [];
                        for (const s of sList) {
                            const sid = Number(s.id || s.student_id);
                            if (sid) sids.push(sid);
                        }

                        if (sids.length > 0) {
                            g.student_ids = sids;
                        }
                    } catch (e) {
                        console.error(
                            `[homework/groups] ошибка student_profiles для ${g.group_id}:`,
                            e
                        );
                    }
                })
            );
        }

        // ============ Подтягиваем тексты ДЗ для уроков, где has_to_give ============
        const homeworkIdsToLoad: number[] = [];
        for (const g of groupsMap.values()) {
            for (const l of g.lessons) {
                if (l.has_to_give && l.homework_id) {
                    homeworkIdsToLoad.push(l.homework_id);
                }
            }
        }

        if (homeworkIdsToLoad.length > 0) {
            const hwTexts = new Map<number, string>();
            const CHUNK = 30;

            for (let i = 0; i < homeworkIdsToLoad.length; i += CHUNK) {
                const chunk = homeworkIdsToLoad.slice(i, i + CHUNK);
                const idsParam = chunk.join(",");

                try {
                    const hwUrl = `https://school.mos.ru/api/ej/core/teacher/v1/homeworks?ids=${idsParam}&with_entries=true`;
                    const hwRes = await fetch(hwUrl, {
                        headers: { ...headers, "x-mes-subsystem": "teacherweb" },
                    });

                    if (hwRes.ok) {
                        const hwData = await hwRes.json();
                        const list = Array.isArray(hwData) ? hwData : [hwData];

                        for (const hw of list) {
                            const hid = Number(hw?.id);
                            if (!hid) continue;
                            const entries = hw.homework_entries || [];
                            const desc = entries
                                .map((e: any) => e.description || "")
                                .filter(Boolean)
                                .join("\n\n")
                                .trim();
                            if (desc) hwTexts.set(hid, desc);
                        }
                    }
                } catch (e) {
                    console.warn("[homework/groups] не удалось загрузить тексты ДЗ:", e);
                }
            }

            for (const g of groupsMap.values()) {
                for (const l of g.lessons) {
                    if (l.homework_id && hwTexts.has(l.homework_id)) {
                        l.homework_text = hwTexts.get(l.homework_id) || "";
                    }
                }
            }
        }

        // Чистим технические поля
        const groups = [...groupsMap.values()].map((g) => ({
            ...g,
            lessons: g.lessons.map((l) => {
                const { class_unit_id, ...rest } = l;
                return rest;
            }),
        }));

        return NextResponse.json({ ok: true, academicYear, groups });
    } catch (e: any) {
        console.error("[homework/groups] error:", e);
        return NextResponse.json({ detail: e.message }, { status: 500 });
    }
}