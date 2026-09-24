// src/app/api/homework/update/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cacheInvalidate } from "@/lib/cache";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  const tokenRow = await prisma.token.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { grantedAt: "desc" },
  });

  if (!tokenRow)
    return NextResponse.json({ detail: "Нет токена МЭШ" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json({ detail: "Нужен id" }, { status: 400 });

  const meshToken = tokenRow.token;
  const teacherId = Number(user.profileId);

  try {
    const r = await fetch(
      `https://school.mos.ru/api/ej/core/teacher/v1/homeworks?ids=${id}&with_entries=true`,
      {
        headers: {
          authorization: `Bearer ${meshToken}`,
          "profile-id": String(teacherId),
          "x-mes-hostid": "9",
          "x-mes-roleid": "9",
          "x-mes-subsystem": "teacherweb",
          aid: "14",
          accept: "*/*",
        },
      }
    );

    if (!r.ok) {
      return NextResponse.json(
        { detail: `Ошибка МЭШ: ${r.status}` },
        { status: r.status }
      );
    }

    const data = await r.json();
    const list = Array.isArray(data) ? data : [data];
    return NextResponse.json({ ok: true, homework: list[0] || null });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  const tokenRow = await prisma.token.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { grantedAt: "desc" },
  });

  if (!tokenRow)
    return NextResponse.json({ detail: "Нет токена МЭШ" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { homework_id, description } = body;

  if (!homework_id) {
    return NextResponse.json({ detail: "Нужен homework_id" }, { status: 400 });
  }

  const meshToken = tokenRow.token;
  const teacherId = Number(user.profileId);

  const headers = {
    authorization: `Bearer ${meshToken}`,
    "content-type": "application/json",
    "profile-id": String(teacherId),
    "x-mes-hostid": "9",
    "x-mes-roleid": "9",
    "x-mes-subsystem": "teacherweb",
    aid: "14",
    accept: "*/*",
  };

  try {
    // Читаем текущее ДЗ
    const getRes = await fetch(
      `https://school.mos.ru/api/ej/core/teacher/v1/homeworks/${homework_id}`,
      { headers }
    );

    if (!getRes.ok) {
      return NextResponse.json(
        { detail: `Не удалось прочитать ДЗ: ${getRes.status}` },
        { status: getRes.status }
      );
    }

    const existing = await getRes.json();
    const entries = existing.homework_entries || [];
    if (entries.length > 0 && description !== undefined) {
      entries[0].description = description;
    }

    const putRes = await fetch(
      `https://school.mos.ru/api/ej/core/teacher/v1/homeworks/${homework_id}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...existing, homework_entries: entries }),
      }
    );

    const text = await putRes.text();

    if (!putRes.ok) {
      return NextResponse.json(
        { detail: `Ошибка МЭШ: ${putRes.status}`, raw: text.slice(0, 500) },
        { status: putRes.status }
      );
    }

    // ============ Инвалидация кэша ============
    cacheInvalidate("schedule:");
    cacheInvalidate("homework-text:");

    await prisma.logEntry.create({
      data: {
        userId: user.id,
        action: "HOMEWORK_UPDATED",
        details: `homework_id=${homework_id}`,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 });
  }
}