/** True when the error looks like the server accepted TCP but is still starting. */
export function isTransientStartupError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  return (
    lower.includes("connection terminated unexpectedly") ||
    lower.includes("econnreset") ||
    lower.includes("econnrefused") ||
    lower.includes("connection refused") ||
    lower.includes("server closed the connection") ||
    lower.includes("the database system is starting up") ||
    lower.includes("too many connections") ||
    lower.includes("not yet available") ||
    lower.includes("failed to connect") ||
    lower.includes("socket closed") ||
    lower.includes("read econnreset")
  );
}
