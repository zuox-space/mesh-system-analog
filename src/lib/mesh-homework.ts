// src/lib/mesh-homework.ts
import { cacheGet, cacheSet, TTL } from "./cache";

export type HomeworkPresence = {
  lesson_schedule_item_id: number;
  is_homework_absences: boolean;
  is_homework_exist: boolean;
  is_end_prev_lesson?: boolean;
};

/**
 * Запрашивает статусы ДЗ для списка уроков.
 * Возвращает Map: lesson_schedule_item_id → HomeworkPresence
 *
 * Правило:
 *   - is_homework_exist: true — ДЗ задано обычным способом
 *   - is_homework_absences: true — учитель осознанно поставил «без ДЗ»
 *   Оба варианта считаются «ДЗ проставлено».
 */
export async function fetchHomeworkPresence(
  meshToken: string,
  teacherId: number,
  lessonIds: number[]
): Promise<Map<number, HomeworkPresence>> {
  const result = new Map<number, HomeworkPresence>();

  if (lessonIds.length === 0) return result;

  const CHUNK = 100;

  for (let i = 0; i < lessonIds.length; i += CHUNK) {
    const chunk = lessonIds.slice(i, i + CHUNK);
    const idsParam = [...chunk].sort((a, b) => a - b).join(",");

    const cacheKey = `presence:${teacherId}:${idsParam}`;
    const cached = cacheGet<HomeworkPresence[]>(cacheKey);

    if (cached) {
      for (const p of cached) {
        result.set(p.lesson_schedule_item_id, p);
      }
      continue;
    }

    try {
      const url = new URL(
        "https://school.mos.ru/api/ej/core/teacher/v1/homework_presence"
      );
      url.searchParams.set("lesson_schedule_item_ids", idsParam);

      const r = await fetch(url.toString(), {
        headers: {
          authorization: `Bearer ${meshToken}`,
          "profile-id": String(teacherId),
          "x-mes-hostid": "9",
          "x-mes-roleid": "9",
          "x-mes-subsystem": "teacherweb",
          aid: "14",
          accept: "*/*",
        },
        cache: "no-store",
      });

      if (!r.ok) {
        console.warn(`[homework-presence] failed: ${r.status}`);
        continue;
      }

      const data = await r.json();
      const list: HomeworkPresence[] = Array.isArray(data)
        ? data
        : data.items || data.data || [];

      for (const p of list) {
        result.set(p.lesson_schedule_item_id, p);
      }

      cacheSet(cacheKey, list, TTL.SCHEDULE);
    } catch (e) {
      console.warn("[homework-presence] error:", e);
    }
  }

  return result;
}