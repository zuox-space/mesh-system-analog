import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      extensionToken: null,
      pairCode: null,
      pairCodeExpires: null,
    },
  });

  await prisma.logEntry.create({
    data: {
      userId: user.id,
      action: "EXTENSION_UNLINKED",
    },
  });

  return NextResponse.json({ ok: true });
}