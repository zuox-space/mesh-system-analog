// src/app/api/tokens/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Extension-Token",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const extensionToken = req.headers.get("x-extension-token");
  if (!extensionToken) {
    return NextResponse.json(
      { detail: "Нет токена" },
      { status: 401, headers: CORS }
    );
  }

  const user = await prisma.user.findUnique({
    where: { extensionToken },
  });

  if (!user) {
    return NextResponse.json(
      { detail: "Невалидный токен" },
      { status: 401, headers: CORS }
    );
  }

  const token = await prisma.token.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { grantedAt: "desc" },
  });

  const userPayload = {
    sub: user.sub,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    email: user.email,
  };

  if (!token) {
    return NextResponse.json(
      {
        has_token: false,
        is_valid: false,
        user: userPayload,
        message: "Токен МЭШ не предоставлен",
      },
      { headers: CORS }
    );
  }

  const is_valid = token.expiresAt ? token.expiresAt > new Date() : true;

  return NextResponse.json(
    {
      has_token: true,
      is_valid,
      expires_at: token.expiresAt?.toISOString() || null,
      user: userPayload,
      message: is_valid ? "Токен валиден" : "Токен истёк",
    },
    { headers: CORS }
  );
}