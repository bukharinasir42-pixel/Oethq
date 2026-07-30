const TRANSIENT_DB_ERROR_PATTERNS = [
  "Can't reach database server",
  "Connection terminated unexpectedly",
  "Connection terminated due to connection timeout",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "timeout expired",
  "Server closed the connection unexpectedly"
];

export function isTransientDbError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_DB_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTransientDbRetry<T>(fn: () => Promise<T>, maxAttempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === maxAttempts) {
        throw error;
      }
      await sleep(400 * attempt);
    }
  }

  throw lastError;
}

export function formatDbUnavailableMessage(context?: string) {
  const prefix = context ? `${context} ` : "";
  return (
    `${prefix}Database is temporarily unreachable. ` +
    "Check your internet connection, confirm DATABASE_URL points to your Postgres host (AWS RDS, local Docker, etc.), " +
    "and ensure the server allows connections from this machine (security groups / firewall). For RDS use ?sslmode=require."
  );
}
