import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin1234", 10);

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

  console.log("Seed completed:");
  console.log("  Admin: admin@golf.com / admin1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
