import "../src/load-env";
import { PrismaService } from "../src/common/prisma.service";

async function main() {
  const prisma = new PrismaService();
  try {
    const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    console.log("Database connection OK:", result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Database connection FAILED:");
    console.error(message.slice(0, 500));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
