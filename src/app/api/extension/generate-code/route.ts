import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function generateCode(): string {
  // 6 цифр, ведущие нули сохраняем
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  }

  if (user.accessStatus !== "ACTIVE") {
    return NextResponse.json(
      { detail: "Доступ не активирован" },
      { status: 403 }
    );
  }

  const code = generateCode();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

  await prisma.user.update({
    where: { id: user.id },
    data: {
      pairCode: code,
      pairCodeExpires: expires,
    },
  });

  await prisma.logEntry.create({
    data: {
      userId: user.id,
      action: "PAIR_CODE_GENERATED",
      details: `expires ${expires.toISOString()}`,
    },
  });

  return NextResponse.json({
    ok: true,
    code,
    expiresAt: expires.toISOString(),
  });
}