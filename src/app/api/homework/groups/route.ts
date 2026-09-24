// src/app/api/homework/groups/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fetchCurrentAcademicYear } from "@/lib/academic-year";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";

function isoToDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

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

    // ============ Расписание с кэшем ============
    const scheduleCacheKey = `schedule:${teacherId}:${dateFrom}:${dateTo}`;
    const cachedSchedule = cacheGet<any>(scheduleCacheKey);

    let schData: any;
    if (cachedSchedule) {
      schData = cachedSchedule;
    } else {
      const r = await fetch(url.toString(), { headers, cache: "no-store" });
      if (!r.ok) {
        const text = await r.text();
        return NextResponse.json(
          { detail: `Ошибка МЭШ: ${r.status}`, raw: text.slice(0, 300) },
          { status: r.status }
        );
      }
      schData = await r.json();
      cacheSet(scheduleCacheKey, schData, TTL.SCHEDULE);
    }

    const items = Array.isArray(schData)
      ? schData
      : schData.items || schData.data || [];

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

      const d = lesson.date;
      const dateIso = Array.isArray(d)
        ? `${d[0]}-${String(d[1]).padStart(2, "0")}-${String(d[2]).padStart(2, "0")}`
        : null;

      const t = lesson.time || [];
      const timeStr =
        Array.isArray(t) && t.length >= 2
          ? `${String(t[0]).padStart(2, "0")}:${String(t[1]).padStart(2, "0")}`
          : "";

      const toGive = Array.isArray(lesson.homeworks_to_give)
        ? lesson.homeworks_to_give
        : [];
      const toVerify = Array.isArray(lesson.homeworks_to_verify)
        ? lesson.homeworks_to_verify
        : [];

      const hasToGive = toGive.length > 0;
      const hasToVerify = toVerify.length > 0;
      const hasHomework = hasToGive || hasToVerify;

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
        is_no_hw_note: false, // «Без домашнего задания» через homework_absences
        homework_id: homeworkId,
        homework_text: "",
        class_unit_id: Number(lesson.class_unit_id),
      });
    }

    // ============ Homework absences («Без домашнего задания») ============
    const absencesSet = new Set<string>(); // "groupId|YYYY-MM-DD"
    const ABS_CONCURRENCY = 5;
    const groupListForAbs = [...groupsMap.values()];

    for (let i = 0; i < groupListForAbs.length; i += ABS_CONCURRENCY) {
      const chunk = groupListForAbs.slice(i, i + ABS_CONCURRENCY);

      await Promise.all(
        chunk.map(async (g) => {
          const cacheKey = `absences:${g.group_id}:${dateFrom}:${dateTo}`;
          const cachedDates = cacheGet<string[]>(cacheKey);
          if (cachedDates) {
            console.log(`[criteria] absences ${g.group_id}: ${cachedDates.length} (cache)`);
            for (const d of cachedDates) {
              absencesSet.add(`${g.group_id}|${d}`);
            }
            return;
          }

          try {
            const absUrl = new URL(
              "https://school.mos.ru/api/ej/core/teacher/v1/homework_absences"
            );
            absUrl.searchParams.set("begin_date", isoToDDMMYYYY(dateFrom));
            absUrl.searchParams.set("end_date", isoToDDMMYYYY(dateTo));
            absUrl.searchParams.set("group_id", String(g.group_id));
            absUrl.searchParams.set("page", "1");
            absUrl.searchParams.set("per_page", "100");

            const absRes = await fetch(absUrl.toString(), {
              headers: { ...headers, "x-mes-subsystem": "teacherweb" },
            });

            if (!absRes.ok) {
              console.warn(
                `[homework/groups] absences ${g.group_id}: ${absRes.status}`
              );
              return;
            }

            const absData = await absRes.json();
            const list = Array.isArray(absData)
              ? absData
              : absData.items || absData.data || [];

            const dates: string[] = [];
            for (const a of list) {
              if (a.deleted_at) continue;
              if (!a.date) continue;
              const [dd, mm, yyyy] = String(a.date).split(".");
              if (!dd || !mm || !yyyy) continue;
              const iso = `${yyyy}-${mm}-${dd}`;
              dates.push(iso);
              absencesSet.add(`${g.group_id}|${iso}`);
            }

            cacheSet(cacheKey, dates, TTL.SCHEDULE);
          } catch (e) {
            console.warn(
              `[homework/groups] absences ${g.group_id} error:`,
              e
            );
          }
        })
      );
    }

    // Проставляем is_no_hw_note + has_homework на уроках
    for (const g of groupsMap.values()) {
      for (const l of g.lessons) {
        if (!l.date) continue;
        if (absencesSet.has(`${g.group_id}|${l.date}`)) {
          // Если у урока уже есть реальное ДЗ (homework_id) — не помечаем особым
          if (!l.homework_id) {
            l.is_no_hw_note = true;
          }
          l.has_homework = true; // считаем это как «ДЗ задано»
        }
      }
    }

    // ============ Ученики (кэш на час) ============
    const CONCURRENCY = 5;
    const groupList = [...groupsMap.values()];

    for (let i = 0; i < groupList.length; i += CONCURRENCY) {
      const chunk = groupList.slice(i, i + CONCURRENCY);

      await Promise.all(
        chunk.map(async (g) => {
          const studentsCacheKey = `students:${g.group_id}`;
          const cachedStudents = cacheGet<number[]>(studentsCacheKey);

          if (cachedStudents) {
            g.student_ids = cachedStudents;
            return;
          }

          const sampleLesson = g.lessons.find((l) => l.class_unit_id);
          const classUnitId = sampleLesson?.class_unit_id;

          if (!classUnitId) return;

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

            if (!studentsRes.ok) return;

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
              cacheSet(studentsCacheKey, sids, TTL.STUDENTS);
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

    // ============ Тексты ДЗ ============
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

        const hwCacheKey = `homework-text:${idsParam}`;
        const cachedTexts = cacheGet<Record<number, string>>(hwCacheKey);

        if (cachedTexts) {
          for (const [hid, txt] of Object.entries(cachedTexts)) {
            hwTexts.set(Number(hid), txt);
          }
          continue;
        }

        try {
          const hwUrl = `https://school.mos.ru/api/ej/core/teacher/v1/homeworks?ids=${idsParam}&with_entries=true`;
          const hwRes = await fetch(hwUrl, {
            headers: { ...headers, "x-mes-subsystem": "teacherweb" },
          });

          if (hwRes.ok) {
            const hwData = await hwRes.json();
            const list = Array.isArray(hwData) ? hwData : [hwData];
            const cacheObj: Record<number, string> = {};

            for (const hw of list) {
              const hid = Number(hw?.id);
              if (!hid) continue;
              const entries = hw.homework_entries || [];
              const desc = entries
                .map((e: any) => e.description || "")
                .filter(Boolean)
                .join("\n\n")
                .trim();
              if (desc) {
                hwTexts.set(hid, desc);
                cacheObj[hid] = desc;
              }
            }

            cacheSet(hwCacheKey, cacheObj, TTL.SCHEDULE);
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