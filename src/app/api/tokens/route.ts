// src/app/api/tokens/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  decodeMeshToken,
  expToDate,
  iatToDate,
  fetchMeshUserInfo,
  fetchMeshSession,
  findTeacherProfile,
} from "@/lib/mesh";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Extension-Token",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  try {
    const extensionToken = req.headers.get("x-extension-token");
    const body = await req.json().catch(() => ({}));
    const meshToken = String(body.token || "").trim();

    if (!meshToken) {
      return NextResponse.json(
        { detail: "Пустой токен МЭШ" },
        { status: 400, headers: CORS }
      );
    }

    const payload = decodeMeshToken(meshToken);
    if (!payload?.sub) {
      return NextResponse.json(
        { detail: "Невалидный JWT или нет sub" },
        { status: 400, headers: CORS }
      );
    }

    // Находим пользователя по extensionToken
    let user = null;
    if (extensionToken) {
      user = await prisma.user.findUnique({ where: { extensionToken } });
    }
    if (!user) {
      user = await prisma.user.findUnique({ where: { sub: payload.sub } });
    }
    if (!user) {
      return NextResponse.json(
        {
          detail:
            "Пользователь не найден. Сначала свяжите расширение с аккаунтом.",
        },
        { status: 404, headers: CORS }
      );
    }

    // 1) userinfo — ФИО, email, аватар
    const info = await fetchMeshUserInfo(meshToken);

    // 2) sessions — профили, отсюда teacher profile_id
    const session = await fetchMeshSession(meshToken);
    const teacherProfile = session ? findTeacherProfile(session) : null;
    const profileId = teacherProfile?.id || null;

    console.log(
      "[tokens] userinfo:",
      info?.email,
      "| teacher profileId:",
      profileId
    );

    // Проверка занятости email
    let newEmail = info?.email || user.email;
    if (newEmail && newEmail !== user.email) {
      const occupied = await prisma.user.findFirst({
        where: { email: newEmail, id: { not: user.id } },
      });
      if (occupied) {
        console.warn(
          `[tokens] email ${newEmail} занят user ${occupied.id}, не перезаписываем`
        );
        newEmail = user.email;
      }
    }

    // Обновляем пользователя
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: info?.given_name || user.firstName,
        lastName: info?.family_name || user.lastName,
        middleName: info?.middle_name || user.middleName,
        email: newEmail,
        profileId: profileId ? BigInt(profileId) : user.profileId,
      },
    });

    const expiresAt = expToDate(payload.exp);
    const issuedAt = iatToDate(payload.iat);

    await prisma.token.updateMany({
      where: { userId: updated.id, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });

    const saved = await prisma.token.upsert({
      where: { token: meshToken },
      update: {
        userId: updated.id,
        expiresAt,
        issuedAt,
        isActive: true,
        revokedAt: null,
        grantedAt: new Date(),
      },
      create: {
        userId: updated.id,
        token: meshToken,
        expiresAt,
        issuedAt,
        isActive: true,
      },
    });

    await prisma.logEntry.create({
      data: {
        userId: updated.id,
        action: "TOKEN_GRANTED",
        details: `expires ${expiresAt?.toISOString() || "unknown"} profileId=${
          profileId || "?"
        }`,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        tokenId: saved.id,
        expiresAt: expiresAt?.toISOString() || null,
        user: {
          id: updated.id,
          sub: updated.sub,
          firstName: updated.firstName,
          lastName: updated.lastName,
          middleName: updated.middleName,
          email: updated.email,
          profileId: updated.profileId ? Number(updated.profileId) : null,
        },
      },
      { headers: CORS }
    );
  } catch (e: any) {
    console.error("[tokens] POST failed:", e);
    return NextResponse.json(
      { detail: e?.message || "Внутренняя ошибка сервера" },
      { status: 500, headers: CORS }
    );
  }
}