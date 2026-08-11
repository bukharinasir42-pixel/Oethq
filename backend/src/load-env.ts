import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Load monorepo root `.env` then `backend/.env` (overrides) for local runs.
 * Skip only when explicitly disabled (ECS/App Runner inject env and may set SKIP_DOTENV=1).
 * Note: backend/.env often sets NODE_ENV=production for parity — that must NOT skip dotenv locally.
 */
function loadEnvFiles() {
  if (process.env.SKIP_DOTENV === "1" || process.env.SKIP_DOTENV === "true") {
    return;
  }

  let config: typeof import("dotenv").config;
  try {
    // dotenv is a dev dependency and is absent in the deployed image, where the
    // platform injects the environment instead. A static import would fail at
    // load; this one is caught below and the function simply returns.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ config } = require("dotenv") as typeof import("dotenv"));
  } catch {
    return;
  }

  const backendDir = path.resolve(__dirname, "..");
  const repoRootDir = path.resolve(backendDir, "..");
  const repoEnv = path.join(repoRootDir, ".env");
  const backendEnv = path.join(backendDir, ".env");

  if (existsSync(repoEnv)) {
    config({ path: repoEnv });
  }
  if (existsSync(backendEnv)) {
    config({ path: backendEnv, override: true });
  }
}

loadEnvFiles();
