// src/app/api/schedule/plan/purge/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// DELETE — полностью удалить план вместе с уроками
export async function DELETE() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
    }

    // onDelete: Cascade в схеме Prisma удалит уроки автоматически
    const result = await prisma.lessonPlan.deleteMany({
        where: { userId: user.id },
    });

    return NextResponse.json({ ok: true, deleted: result.count });
}