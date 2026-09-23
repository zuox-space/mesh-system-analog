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
  const token = req.headers.get("x-extension-token");
  if (!token) {
    return NextResponse.json(
      { detail: "Нет токена" },
      { status: 401, headers: CORS }
    );
  }

  const user = await prisma.user.findUnique({
    where: { extensionToken: token },
  });

  if (!user) {
    return NextResponse.json(
      { detail: "Невалидный токен" },
      { status: 401, headers: CORS }
    );
  }

  if (user.accessStatus !== "ACTIVE") {
    return NextResponse.json(
      { detail: "Доступ не активирован" },
      { status: 403, headers: CORS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: user.id,
        sub: user.sub,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        email: user.email,
      },
    },
    { headers: CORS }
  );
}