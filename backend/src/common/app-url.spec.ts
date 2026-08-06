/**
 * The cohort-email link bug.
 *
 * Links were built from `process.env.FRONTEND_ORIGIN || ""`, and that variable
 * is set nowhere and read nowhere else. So every cohort email went out with a
 * bare path, and the mail client turned it into `http:///portal/tasks?day=3` —
 * no host, three slashes, rejected by every browser. Students clicking their
 * class link from Gmail landed on a Google redirect error.
 *
 * The property that matters is not "returns the right host" — it is "NEVER
 * returns a relative link", because that is the failure that reaches a student.
 */
import { appLink, resolveAppUrl } from "./app-url";

const ENV = ["NEXT_PUBLIC_APP_URL", "PUBLIC_APP_URL", "FRONTEND_ORIGIN", "FRONTEND_URL"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("appLink", () => {
  it("never produces the host-less URL students were sent", () => {
    // With nothing configured at all — the exact production condition.
    const link = appLink("/portal/tasks?day=3");
    expect(link).not.toBe("/portal/tasks?day=3");
    expect(link).not.toMatch(/^http:\/\/\//);
    expect(link).toBe("http://localhost:3000/portal/tasks?day=3");
  });

  it("is absolute whatever the environment looks like", () => {
    for (const env of [{}, { NEXT_PUBLIC_APP_URL: "" }, { FRONTEND_ORIGIN: "" }]) {
      for (const k of ENV) delete process.env[k];
      Object.assign(process.env, env);
      const link = appLink("/portal/tasks");
      expect(link).toMatch(/^https?:\/\/[^/]+\/portal\/tasks$/);
    }
  });

  it("uses NEXT_PUBLIC_APP_URL, the variable the rest of the app reads", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oethq.com";
    expect(appLink("/portal/tasks?day=3")).toBe("https://oethq.com/portal/tasks?day=3");
  });

  it("still honours FRONTEND_ORIGIN if an environment happens to set it", () => {
    process.env.FRONTEND_ORIGIN = "https://app.oethq.com";
    expect(appLink("/portal/tasks")).toBe("https://app.oethq.com/portal/tasks");
  });

  it("prefers NEXT_PUBLIC_APP_URL over the older aliases", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oethq.com";
    process.env.FRONTEND_ORIGIN = "https://stale.example";
    expect(resolveAppUrl()).toBe("https://oethq.com");
  });

  it("does not double the slash when the base has a trailing one", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oethq.com/";
    expect(appLink("/portal/tasks")).toBe("https://oethq.com/portal/tasks");
  });

  it("accepts a path with or without its leading slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://oethq.com";
    expect(appLink("portal/tasks")).toBe("https://oethq.com/portal/tasks");
  });

  it("reads through a config getter when one is supplied", () => {
    const get = (k: string) => (k === "NEXT_PUBLIC_APP_URL" ? "https://from-config.test" : undefined);
    expect(resolveAppUrl(get)).toBe("https://from-config.test");
  });
});
