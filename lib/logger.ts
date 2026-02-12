/**
 * Structured error logging. Outputs JSON for log aggregation.
 * Do not include secrets in meta.
 */
export function logError(
  prefix: string,
  err: unknown,
  meta?: Record<string, unknown>
): void {
  const message = err instanceof Error ? err.message : String(err);
  const output = {
    level: 'error',
    timestamp: new Date().toISOString(),
    prefix,
    message,
    ...(meta && Object.keys(meta).length > 0 && { ...meta }),
  };
  console.error(JSON.stringify(output));
}
