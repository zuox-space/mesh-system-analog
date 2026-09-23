import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim();

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { detail: "Код должен состоять из 6 цифр" },
        { status: 400, headers: CORS }
      );
    }

    const user = await prisma.user.findFirst({
      where: { pairCode: code },
    });

    if (!user) {
      return NextResponse.json(
        { detail: "Неверный код" },
        { status: 404, headers: CORS }
      );
    }

    if (!user.pairCodeExpires || user.pairCodeExpires < new Date()) {
      return NextResponse.json(
        { detail: "Код истёк. Сгенерируйте новый в личном кабинете." },
        { status: 410, headers: CORS }
      );
    }

    if (user.accessStatus !== "ACTIVE") {
      return NextResponse.json(
        { detail: "Доступ не активирован" },
        { status: 403, headers: CORS }
      );
    }

    // Генерируем постоянный extensionToken
    const extensionToken = crypto.randomBytes(32).toString("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        extensionToken,
        pairCode: null,
        pairCodeExpires: null,
      },
    });

    await prisma.logEntry.create({
      data: {
        userId: user.id,
        action: "EXTENSION_LINKED",
      },
    });

    return NextResponse.json(
      {
        ok: true,
        extensionToken,
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
  } catch (e: any) {
    console.error("[extension/link] failed:", e);
    return NextResponse.json(
      { detail: "Внутренняя ошибка сервера" },
      { status: 500, headers: CORS }
    );
  }
}