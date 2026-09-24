// src/app/api/schedule/plan/activate/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST — запустить план (isActive = true)
export async function POST() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
    }

    const plan = await prisma.lessonPlan.findUnique({
        where: { userId: user.id },
    });

    if (!plan) {
        return NextResponse.json({ detail: "План не создан" }, { status: 404 });
    }

    await prisma.lessonPlan.update({
        where: { id: plan.id },
        data: { isActive: true },
    });

    return NextResponse.json({ ok: true, planId: plan.id, active: true });
}