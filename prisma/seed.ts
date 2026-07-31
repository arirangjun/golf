import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin1234", 10);
  const memberPassword = await bcrypt.hash("1", 10);

  await prisma.user.upsert({
    where: { email: "admin@golf.com" },
    update: { dong: "0", ho: "admin" },
    create: {
      email: "admin@golf.com",
      passwordHash: adminPassword,
      name: "관리자",
      dong: "0",
      ho: "admin",
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const memberEmail = "101-1001@member.golf";
  await prisma.user.upsert({
    where: { email: memberEmail },
    update: {
      dong: "101",
      ho: "1001",
      passwordHash: memberPassword,
      name: "홍길동",
    },
    create: {
      email: memberEmail,
      passwordHash: memberPassword,
      name: "홍길동",
      dong: "101",
      ho: "1001",
      role: Role.USER,
      isActive: true,
    },
  });

  console.log("Seed completed:");
  console.log("  Admin: admin@golf.com / admin1234");
  console.log("  Member: 101동 1001호 / password: 1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
