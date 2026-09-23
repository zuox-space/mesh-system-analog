import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const firstName = String(body.firstName || "").trim() || null;
  const lastName = String(body.lastName || "").trim() || null;
  const middleName = String(body.middleName || "").trim() || null;

  if (!email || !password) {
    return NextResponse.json(
      { detail: "Email и пароль обязательны" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { detail: "Пароль минимум 6 символов" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { detail: "Пользователь с таким email уже существует" },
      { status: 409 }
    );
  }

  const hash = await bcrypt.hash(password, 10);

  // sub для локального пользователя = "local:<email>"
  const sub = `local:${email}`;

  const user = await prisma.user.create({
    data: {
      sub,
      email,
      passwordHash: hash,
      role: "TEACHER",
      accessStatus: "PENDING",
      firstName,
      lastName,
      middleName,
    },
  });

  await prisma.logEntry.create({
    data: {
      userId: user.id,
      action: "USER_REGISTERED",
      details: `email ${email}`,
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      accessStatus: user.accessStatus,
    },
  });
}