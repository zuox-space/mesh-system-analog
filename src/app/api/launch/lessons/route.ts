// src/app/api/launch/lessons/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fetchCurrentAcademicYear } from "@/lib/academic-year";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";

type LaunchLesson = {
  id: number;
  date: string;
  time: string;
  study_ordinal: number;
  lesson_name: string;
  topic_name: string;
  group_id: number;
  group_name: string;
  class_unit_name: string;
  subject_id: number;
  subject_name: string;
  room_name: string;
  script_uuid: string | null;
  script_uuid_material: string | null;
  script_name: string | null;
};

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
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

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

    // Кэш расписания на 5 минут
    const cacheKey = `schedule:${teacherId}:${dateFrom}:${dateTo}`;
    let data = cacheGet<any>(cacheKey);

    if (data) {
      console.log("[launch/lessons] schedule from cache");
    } else {
      const r = await fetch(url.toString(), { headers, cache: "no-store" });
      if (!r.ok) {
        const text = await r.text();
        return NextResponse.json(
          { detail: `Ошибка МЭШ: ${r.status}`, raw: text.slice(0, 300) },
          { status: r.status }
        );
      }
      data = await r.json();
      cacheSet(cacheKey, data, TTL.SCHEDULE);
      console.log("[launch/lessons] schedule cached");
    }

    const items = Array.isArray(data) ? data : data.items || data.data || [];

    const lessons: LaunchLesson[] = [];

    for (const lesson of items) {
      if (lesson.cancelled) continue;
      if (lesson.teacher_id && Number(lesson.teacher_id) !== teacherId) continue;
      if (lesson.replaced) {
        const rid = lesson.replaced_teacher_id;
        if (rid && Number(rid) !== teacherId) continue;
      }

      const d = lesson.date;
      if (!Array.isArray(d)) continue;
      const dateIso = `${d[0]}-${String(d[1]).padStart(2, "0")}-${String(
        d[2]
      ).padStart(2, "0")}`;

      const t = lesson.time || [];
      const timeStr =
        Array.isArray(t) && t.length >= 2
          ? `${String(t[0]).padStart(2, "0")}:${String(t[1]).padStart(2, "0")}`
          : "";

      // Извлекаем uuid сценария из scripts_new или scripts
      let scriptUuid: string | null = null;

      if (Array.isArray(lesson.scripts_new) && lesson.scripts_new.length > 0) {
        scriptUuid = lesson.scripts_new[0].uuid || null;
      } else if (lesson.scripts && typeof lesson.scripts === "string") {
        try {
          const parsed = JSON.parse(lesson.scripts);
          if (Array.isArray(parsed) && parsed.length > 0) {
            scriptUuid = parsed[0].uuid || null;
          }
        } catch {}
      }

      lessons.push({
        id: lesson.id,
        date: dateIso,
        time: timeStr,
        study_ordinal: lesson.study_ordinal,
        lesson_name: lesson.lesson_name || "",
        topic_name: lesson.topic_name || "",
        group_id: Number(lesson.group_id),
        group_name: lesson.group_name || lesson.class_unit_name || "",
        class_unit_name: lesson.class_unit_name || "",
        subject_id: Number(lesson.subject_id) || 0,
        subject_name: lesson.subject_name || "",
        room_name: lesson.room_name || "",
        script_uuid: scriptUuid,
        script_uuid_material: null,
        script_name: null,
      });
    }

    // ============ Разрешаем uuid → original_uuid через bulk/uuids ============
    const uuidsToResolve = new Set<string>();
    for (const l of lessons) {
      if (l.script_uuid) uuidsToResolve.add(l.script_uuid);
    }

    const materials: Record<string, { original_uuid: string; name: string }> = {};

    if (uuidsToResolve.size > 0) {
      const uuidsArr = [...uuidsToResolve];
      const CHUNK = 50;

      for (let i = 0; i < uuidsArr.length; i += CHUNK) {
        const chunk = uuidsArr.slice(i, i + CHUNK);

        // Проверяем кэш материалов
        const missingFromCache: string[] = [];
        for (const uuid of chunk) {
          const cached = cacheGet<{ original_uuid: string; name: string }>(
            `material:${uuid}`
          );
          if (cached) {
            materials[uuid] = cached;
          } else {
            missingFromCache.push(uuid);
          }
        }

        if (missingFromCache.length === 0) {
          console.log("[launch/lessons] materials from cache");
          continue;
        }

        try {
          const r = await fetch(
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
              body: JSON.stringify(missingFromCache),
            }
          );

          if (r.ok) {
            const bulkData = await r.json();
            const list = Array.isArray(bulkData)
              ? bulkData
              : bulkData.items || bulkData.data || [];

            for (const m of list) {
              if (!m.uuid || !m.original_uuid) continue;
              const val = {
                original_uuid: String(m.original_uuid),
                name: String(m.name || ""),
              };
              materials[m.uuid] = val;
              cacheSet(`material:${m.uuid}`, val, TTL.ROOMS);
            }
            console.log(
              `[launch/lessons] resolved ${list.length} materials`
            );
          } else {
            console.warn(
              `[launch/lessons] bulk/uuids failed: ${r.status}`
            );
          }
        } catch (e) {
          console.warn("[launch/lessons] bulk materials error:", e);
        }
      }
    }

    // Подставляем original_uuid в уроки
    for (const l of lessons) {
      if (l.script_uuid && materials[l.script_uuid]) {
        l.script_uuid_material = materials[l.script_uuid].original_uuid;
        l.script_name = materials[l.script_uuid].name;
      }
    }

    return NextResponse.json({
      ok: true,
      academicYear,
      teacherId,
      lessons,
    });
  } catch (e: any) {
    console.error("[launch/lessons] error:", e);
    return NextResponse.json({ detail: e.message }, { status: 500 });
  }
}