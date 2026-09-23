import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession } from "@/lib/jwt";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return NextResponse.json({ detail: "Email и пароль обязательны" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    return NextResponse.json({ detail: "Неверные данные" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ detail: "Неверные данные" }, { status: 401 });
  }

  // Проверка статуса доступа
  if (user.accessStatus === "PENDING") {
    return NextResponse.json(
      { detail: "Ваш аккаунт ожидает подтверждения администратором" },
      { status: 403 }
    );
  }

  if (user.accessStatus === "BLOCKED") {
    return NextResponse.json(
      { detail: "Доступ к сервису заблокирован" },
      { status: 403 }
    );
  }

  const token = await signSession({
    userId: user.id,
    sub: user.sub,
    role: user.role as "TEACHER" | "ADMIN",
  });

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      accessStatus: user.accessStatus,
    },
  });

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}