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
      { detail: "Не известен profile_id. Перепривяжите токен через расширение." },
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

  const url = new URL(
    "https://school.mos.ru/api/ej/plan/teacher/v1/schedule_items"
  );
  url.searchParams.set("academic_year_id", "14");
  url.searchParams.set("teacher_id", String(teacherId));
  url.searchParams.set("from", dateFrom);
  url.searchParams.set("to", dateTo);
  url.searchParams.set("with_course_calendar_info", "true");
  url.searchParams.set("with_group_class_subject_info", "true");
  url.searchParams.set("with_lesson_info", "true");
  url.searchParams.set("with_rooms_info", "true");
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "400");
  url.searchParams.set("original", "true");

  try {
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
    });

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        {
          detail: `Ошибка МЭШ: ${r.status}`,
          raw: text.slice(0, 500),
        },
        { status: r.status }
      );
    }

    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { detail: e.message || "Ошибка запроса" },
      { status: 500 }
    );
  }
}