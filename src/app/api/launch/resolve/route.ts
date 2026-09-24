// src/app/api/launch/resolve/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cacheGet, cacheSet } from "@/lib/cache";

const TTL_MATERIAL = 60 * 60 * 1000; // 1 час

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  }

  const tokenRow = await prisma.token.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { grantedAt: "desc" },
  });

  if (!tokenRow) {
    return NextResponse.json({ detail: "Нет токена МЭШ" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const uuids: string[] = Array.isArray(body.uuids) ? body.uuids : [];

  if (uuids.length === 0) {
    return NextResponse.json({ ok: true, materials: {} });
  }

  const meshToken = tokenRow.token;
  const teacherId = Number(user.profileId);

  // Проверяем кэш
  const result: Record<string, { id: number; original_uuid: string; name: string }> = {};
  const missing: string[] = [];

  for (const uuid of uuids) {
    const cached = cacheGet<{ id: number; original_uuid: string; name: string }>(
      `material:${uuid}`
    );
    if (cached) {
      result[uuid] = cached;
    } else {
      missing.push(uuid);
    }
  }

  if (missing.length === 0) {
    return NextResponse.json({ ok: true, materials: result });
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
        body: JSON.stringify(missing),
      }
    );

    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { detail: `Ошибка МЭШ: ${r.status}`, raw: text.slice(0, 300) },
        { status: r.status }
      );
    }

    const data = await r.json();
    const list = Array.isArray(data) ? data : data.items || data.data || [];

    for (const m of list) {
      if (!m.uuid || !m.original_uuid) continue;
      const val = {
        id: Number(m.id),
        original_uuid: String(m.original_uuid),
        name: String(m.name || ""),
      };
      result[m.uuid] = val;
      cacheSet(`material:${m.uuid}`, val, TTL_MATERIAL);
    }

    return NextResponse.json({ ok: true, materials: result });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 });
  }
}