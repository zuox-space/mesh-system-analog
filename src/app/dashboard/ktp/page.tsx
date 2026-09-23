// src/app/dashboard/ktp/page.tsx
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { KtpView } from "./KtpView";

export default async function KtpPage() {
    const user = await getCurrentUser();
    if (!user) return null;

    const token = await prisma.token.findFirst({
        where: { userId: user.id, isActive: true },
        orderBy: { grantedAt: "desc" },
    });

    const tokenActive =
        token && (!token.expiresAt || token.expiresAt > new Date());

    if (!tokenActive) {
        return (
            <Card className="w-full">
                <CardTitle>КТП</CardTitle>
                <p className="text-slate-500 text-[13px]">
                    Нужен активный токен МЭШ. Установите расширение и разрешите доступ.
                </p>
            </Card>
        );
    }

    return <KtpView />;
}