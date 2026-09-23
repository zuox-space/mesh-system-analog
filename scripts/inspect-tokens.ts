import { prisma } from "../src/lib/prisma";

async function main() {
    const users = await prisma.user.findMany({
        include: {
            tokens: { orderBy: { grantedAt: "desc" }, take: 3 },
        },
    });

    for (const u of users) {
        console.log(`\n=== User ${u.id} ${u.email} ===`);
        console.log(`  sub: ${u.sub}`);
        console.log(`  profileId: ${u.profileId}`);
        console.log(`  extensionToken: ${u.extensionToken ? u.extensionToken.slice(0, 16) + "..." : "—"}`);

        for (const t of u.tokens) {
            const exp = t.expiresAt ? t.expiresAt.toISOString() : "null";
            const now = new Date().toISOString();
            const valid = t.isActive && t.expiresAt && t.expiresAt > new Date();
            console.log(
                `  token id=${t.id} isActive=${t.isActive} expiresAt=${exp} NOW=${now} valid=${valid ? "YES" : "NO"}`
            );
        }
    }
}

main().finally(() => prisma.$disconnect());