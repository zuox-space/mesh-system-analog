// src/app/api/ktp/action/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cacheInvalidate } from "@/lib/cache";

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

  const body = await req.json().catch(() => ({}));
  const { plan_id } = body;

  if (!plan_id) {
    return NextResponse.json({ detail: "Нужен plan_id" }, { status: 400 });
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

  const baseUrl = `https://school.mos.ru/api/ej/plan/teacher/v1/calendar_plans/${plan_id}`;

  // Шаг 1: finish
  try {
    const r1 = await fetch(`${baseUrl}/finish?ignore_IA=true`, {
      method: "POST",
      headers,
    });
    const text1 = await r1.text();

    if (!r1.ok) {
      return NextResponse.json(
        {
          detail: `Ошибка «Достроить»: ${r1.status}`,
          raw: text1.slice(0, 500),
        },
        { status: r1.status }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { detail: `Ошибка «Достроить»: ${e.message}` },
      { status: 500 }
    );
  }

  // Шаг 2: recalc
  try {
    const r2 = await fetch(`${baseUrl}/recalc?ignore_IA=true`, {
      method: "POST",
      headers,
    });
    const text2 = await r2.text();

    if (!r2.ok) {
      return NextResponse.json(
        {
          detail: `Даты достроены, но «Пересчитать» упал: ${r2.status}`,
          raw: text2.slice(0, 500),
        },
        { status: r2.status }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { detail: `Даты достроены, но «Пересчитать» упал: ${e.message}` },
      { status: 500 }
    );
  }

  // ============ Инвалидация кэша ============
  cacheInvalidate(`plan:${plan_id}`);
  cacheInvalidate("plans:");
  cacheInvalidate("schedule:");

  await prisma.logEntry.create({
    data: {
      userId: user.id,
      action: "KTP_UPDATE",
      details: `plan_id=${plan_id}`,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "КТП обновлено: даты достроены и пересчитаны",
  });
}