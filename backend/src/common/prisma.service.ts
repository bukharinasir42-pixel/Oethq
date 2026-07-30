import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const poolRegistry = globalThis as typeof globalThis & { __oetPgPool?: Pool };

/** Map libpq-style sslmode to node-pg `ssl` (URL sslmode alone is not always honored). */
function resolvePoolSsl(
  connectionString: string
): boolean | { rejectUnauthorized: boolean } | undefined {
  try {
    const url = new URL(connectionString.replace(/^postgresql:/, "http:"));
    const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
    if (sslmode === "disable") return false;
    if (sslmode === "no-verify") return { rejectUnauthorized: false };
    if (sslmode === "require" || sslmode === "verify-ca" || sslmode === "verify-full") {
      return { rejectUnauthorized: true };
    }
  } catch {
    /* ignore malformed URL */
  }
  return undefined;
}

function createPool(connectionString: string) {
  const ssl = resolvePoolSsl(connectionString);
  return new Pool({
    connectionString,
    ...(ssl !== undefined ? { ssl } : {}),
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 15_000)
  });
}

export class PrismaService extends PrismaClient {
  private static pool: Pool | null = null;

  constructor() {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }

    if (!PrismaService.pool) {
      PrismaService.pool = poolRegistry.__oetPgPool ?? createPool(connectionString);
      if (process.env.NODE_ENV !== "production") {
        poolRegistry.__oetPgPool = PrismaService.pool;
      }
    }

    super({ adapter: new PrismaPg(PrismaService.pool) });
  }

  override async $disconnect() {
    await super.$disconnect();
    if (PrismaService.pool) {
      await PrismaService.pool.end();
      PrismaService.pool = null;
      delete poolRegistry.__oetPgPool;
    }
  }
}
