import { prisma } from "../src/lib/prisma";

async function main() {
    const users = await prisma.user.findMany({
        include: {
            tokens: { orderBy: { grantedAt: "desc" } },
        },
    });

    for (const u of users) {
        if (!u.tokens.length) continue;

        const last = u.tokens[0];
        console.log(`User ${u.id} (${u.email}): last token id=${last.id}, grantedAt=${last.grantedAt}`);

        // Деактивируем все остальные
        await prisma.token.updateMany({
            where: { userId: u.id, id: { not: last.id } },
            data: { isActive: false, revokedAt: new Date() },
        });

        // Активируем последний
        await prisma.token.update({
            where: { id: last.id },
            data: { isActive: true, revokedAt: null },
        });

        console.log(`  -> activated token ${last.id}`);
    }
}

main().finally(() => prisma.$disconnect());