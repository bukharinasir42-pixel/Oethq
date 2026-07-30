export function createLogger(scope: string) {
  return {
    warn: (msg: string) => console.warn(`[${scope}] ${msg}`),
    error: (msg: string) => console.error(`[${scope}] ${msg}`),
    log: (msg: string) => console.log(`[${scope}] ${msg}`)
  };
}
