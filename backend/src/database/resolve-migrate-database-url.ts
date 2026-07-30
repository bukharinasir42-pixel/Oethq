/**
 * Prisma CLI (migrate, db push, etc.) must use a direct Postgres connection.
 * Neon pooler URLs (`-pooler` in the host) cannot acquire Prisma advisory locks reliably.
 */
export function resolveMigrateDatabaseUrl(
  databaseUrl = process.env.DATABASE_URL?.trim(),
  directUrl = process.env.DIRECT_URL?.trim()
): string | undefined {
  if (directUrl) {
    return directUrl;
  }

  if (!databaseUrl) {
    return undefined;
  }

  if (databaseUrl.includes("-pooler")) {
    return databaseUrl.replace("-pooler", "");
  }

  return databaseUrl;
}
