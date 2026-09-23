import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ detail: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);
  if (!userId) {
    return NextResponse.json({ detail: "Неверный id" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tokens: { orderBy: { grantedAt: "desc" }, take: 20 },
      logs: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!user) {
    return NextResponse.json({ detail: "Пользователь не найден" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ detail: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);
  if (!userId) {
    return NextResponse.json({ detail: "Неверный id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const role = body.role as string | undefined;
  const accessStatus = body.accessStatus as string | undefined;

  // Валидация
  const allowedRoles = ["TEACHER", "ADMIN"];
  const allowedStatuses = ["PENDING", "ACTIVE", "BLOCKED"];

  if (role && !allowedRoles.includes(role)) {
    return NextResponse.json({ detail: "Неверная роль" }, { status: 400 });
  }
  if (accessStatus && !allowedStatuses.includes(accessStatus)) {
    return NextResponse.json({ detail: "Неверный статус" }, { status: 400 });
  }

  // Защита: админ не может разжаловать сам себя
  if (userId === admin.id && role && role !== "ADMIN") {
    return NextResponse.json(
      { detail: "Нельзя снять с себя роль администратора" },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(role ? { role } : {}),
      ...(accessStatus ? { accessStatus } : {}),
    },
  });

  await prisma.logEntry.create({
    data: {
      userId: admin.id,
      action: "USER_UPDATED",
      details: `target=${userId} role=${role || "-"} status=${accessStatus || "-"}`,
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}