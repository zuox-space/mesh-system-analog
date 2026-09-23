// src/app/api/schedule/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

  const { searchParams } = new URL(req.url);
  const dateFrom =
    searchParams.get("from") || new Date().toISOString().slice(0, 10);
  const dateTo =
    searchParams.get("to") ||
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const headers = {
    authorization: `Bearer ${meshToken}`,
    "profile-id": String(teacherId),
    "x-mes-hostid": "9",
    "x-mes-roleid": "9",
    aid: "14",
    accept: "*/*",
  };

  // ============ 1. Расписание ============
  const scheduleUrl = new URL(
    "https://school.mos.ru/api/ej/plan/teacher/v1/schedule_items"
  );
  scheduleUrl.searchParams.set("academic_year_id", "14");
  scheduleUrl.searchParams.set("teacher_id", String(teacherId));
  scheduleUrl.searchParams.set("from", dateFrom);
  scheduleUrl.searchParams.set("to", dateTo);
  scheduleUrl.searchParams.set("with_course_calendar_info", "true");
  scheduleUrl.searchParams.set("with_group_class_subject_info", "true");
  scheduleUrl.searchParams.set("with_lesson_info", "true");
  scheduleUrl.searchParams.set("with_rooms_info", "true");
  scheduleUrl.searchParams.set("page", "1");
  scheduleUrl.searchParams.set("per_page", "4000");
  scheduleUrl.searchParams.set("original", "true");

  // ============ 2. Кабинеты ============
  const roomsUrl =
    "https://school.mos.ru/api/ej/core/teacher/v1/rooms";

  try {
    const [schRes, roomsRes] = await Promise.all([
      fetch(scheduleUrl.toString(), {
        headers: { ...headers, "x-mes-subsystem": "teacherweb" },
        cache: "no-store",
      }),
      fetch(roomsUrl, {
        headers: { ...headers, "x-mes-subsystem": "teacherweb" },
        cache: "no-store",
      }),
    ]);

    if (!schRes.ok) {
      const text = await schRes.text();
      return NextResponse.json(
        { detail: `Ошибка МЭШ: ${schRes.status}`, raw: text.slice(0, 500) },
        { status: schRes.status }
      );
    }

    const data = await schRes.json();

    // Строим карту room_id → название
    let roomsMap: Record<number, string> = {};
    if (roomsRes.ok) {
      try {
        const roomsData = await roomsRes.json();
        const roomsList = Array.isArray(roomsData)
          ? roomsData
          : roomsData.items || roomsData.data || [];

        for (const r of roomsList) {
          const id = Number(r.id);
          if (!id) continue;
          // Приоритет: number ("301") → name ("Универсальный кабинет")
          const label =
            (r.number && String(r.number).trim()) ||
            (r.name && String(r.name).trim()) ||
            "";
          if (label) roomsMap[id] = label;
        }
      } catch (e) {
        console.warn("[schedule] rooms parse failed:", e);
      }
    }

    // Обогащаем уроки названием кабинета
    const items = Array.isArray(data) ? data : data.items || data.data || [];
    if (Array.isArray(items)) {
      for (const lesson of items) {
        const rid = Number(lesson.room_id);
        if (rid && roomsMap[rid]) {
          lesson.room_resolved_name = roomsMap[rid];
        }
      }
    }

    return NextResponse.json({
      items,
      rooms: roomsMap,
    });
  } catch (e: any) {
    console.error("[schedule] error:", e);
    return NextResponse.json(
      { detail: e.message || "Ошибка запроса" },
      { status: 500 }
    );
  }
}