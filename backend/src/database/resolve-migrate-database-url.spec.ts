import { resolveMigrateDatabaseUrl } from "./resolve-migrate-database-url";

describe("resolveMigrateDatabaseUrl", () => {
  it("prefers DIRECT_URL when set", () => {
    expect(
      resolveMigrateDatabaseUrl(
        "postgresql://u:p@ep-abc-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
        "postgresql://u:p@ep-abc.us-east-2.aws.neon.tech/neondb?sslmode=require"
      )
    ).toBe("postgresql://u:p@ep-abc.us-east-2.aws.neon.tech/neondb?sslmode=require");
  });

  it("strips -pooler from DATABASE_URL when DIRECT_URL is missing", () => {
    expect(
      resolveMigrateDatabaseUrl(
        "postgresql://u:p@ep-rapid-fire-ae9b1xps-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
      )
    ).toBe("postgresql://u:p@ep-rapid-fire-ae9b1xps.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require");
  });

  it("returns DATABASE_URL unchanged when not pooled", () => {
    const url = "postgresql://oet_admin:oet_password@localhost:5432/oet_lms?schema=public";
    expect(resolveMigrateDatabaseUrl(url)).toBe(url);
  });
});
