import "./load-env";
import "reflect-metadata";
import { createServer, type Server } from "node:http";
import { createAppContainer } from "./http/container";
import { createHttpApp } from "./http/create-app";

const port = Number(process.env.API_PORT) || 4000;
const container = createAppContainer();
const app = createHttpApp(container);

const server: Server = createServer(app);

server.once("listening", () => {
  const env = process.env.NODE_ENV || "development";
  const fmt =
    process.env.MORGAN_FORMAT?.trim() ||
    (process.env.npm_lifecycle_event === "dev" || process.env.npm_lifecycle_event === "start:dev"
      ? "dev"
      : env === "production"
        ? "combined"
        : "dev");
  // eslint-disable-next-line no-console
  console.log(`oet-lms-backend listening on 0.0.0.0:${port} (NODE_ENV=${env})`);
  // eslint-disable-next-line no-console
  console.log(`  Base URL http://127.0.0.1:${port}`);
  // eslint-disable-next-line no-console
  console.log(`  HTTP access log (morgan format: ${fmt}) — one line per request below.`);
  // eslint-disable-next-line no-console
  console.log(`  Press Ctrl+C to stop.`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  // eslint-disable-next-line no-console
  console.error("HTTP server error:", err.message);
  if (err.code === "EADDRINUSE") {
    // eslint-disable-next-line no-console
    console.error(
      `  Port ${port} is already in use. Stop the other process or set API_PORT.\n` +
        `  PowerShell: Get-NetTCPConnection -LocalPort ${port} | Select-Object -Property LocalAddress,LocalPort,OwningProcess,State`
    );
  }
  process.exit(1);
});

server.listen(port, "0.0.0.0");

function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received — closing HTTP server…`);
  server.close(() => {
    void container.prisma
      .$disconnect()
      .catch(() => undefined)
      .finally(() => {
        // eslint-disable-next-line no-console
        console.log("HTTP server closed.");
        process.exit(0);
      });
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
