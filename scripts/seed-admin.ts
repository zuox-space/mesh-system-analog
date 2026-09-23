import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@local";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { sub: "admin" },
    update: {
      role: "ADMIN",
      accessStatus: "ACTIVE",
    },
    create: {
      sub: "admin",
      email,
      passwordHash: hash,
      role: "ADMIN",
      accessStatus: "ACTIVE",
      firstName: "Админ",
      lastName: "Системы",
    },
  });

  console.log("Admin:", admin.email, "password:", password);
}

main().finally(() => prisma.$disconnect());