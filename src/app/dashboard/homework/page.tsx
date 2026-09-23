// src/app/dashboard/homework/page.tsx
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { HomeworkView } from "./HomeworkView";

export default async function HomeworkPage() {
    const user = await getCurrentUser();
    if (!user) return null;

    const token = await prisma.token.findFirst({
        where: { userId: user.id, isActive: true },
        orderBy: { grantedAt: "desc" },
    });

    if (!token || (token.expiresAt && token.expiresAt < new Date())) {
        return (
            <Card className="w-full">
                <CardTitle>Домашние задания</CardTitle>
                <p className="text-slate-500 text-[13px]">
                    Нужен активный токен МЭШ. Установите расширение и разрешите доступ.
                </p>
            </Card>
        );
    }

    return <HomeworkView />;
}