import "./src/load-env";
import { defineConfig } from "prisma/config";
import { resolveMigrateDatabaseUrl } from "./src/database/resolve-migrate-database-url";

/** Used when DATABASE_URL is unset (e.g. CI `npm ci` → postinstall `prisma generate`). Generate does not open a DB connection. */
const PLACEHOLDER_DATABASE_URL =
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public";

const migrateDatabaseUrl =
  resolveMigrateDatabaseUrl() || PLACEHOLDER_DATABASE_URL;

export default defineConfig({
  schema: "./src/database/schema.prisma",
  migrations: {
    path: "./src/database/migrations",
    seed: "npx ts-node --transpile-only -r tsconfig-paths/register ./src/database/seed.ts"
  },
  datasource: {
    // Direct connection for Prisma CLI. Runtime app code uses pooled DATABASE_URL via PrismaPg adapter.
    url: migrateDatabaseUrl,
  },
});
