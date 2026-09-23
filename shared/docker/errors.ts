/** Classify Docker / dockerode errors into short user-facing messages. */
export function mapDockerError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code).toLowerCase()
      : "";

  // Only treat real daemon/socket failures as "Docker not running".
  // Do NOT match bare "connect" — that falsely matches waitForTcp timeouts
  // ("did not accept connections on port…").
  if (
    code === "enoent" ||
    code === "econnrefused" ||
    code === "eacces" ||
    lower.includes("connect enoent") ||
    lower.includes("connect econnrefused") ||
    lower.includes("cannot connect to the docker") ||
    lower.includes("docker desktop is not running") ||
    (lower.includes("socket") &&
      (lower.includes("enoent") || lower.includes("econnrefused")))
  ) {
    return new Error(
      "Docker is not running. Start Docker Desktop (or the Docker daemon) and try again."
    );
  }
  if (lower.includes("conflict") || lower.includes("already in use")) {
    return new Error(
      "A container or volume with that name already exists. Choose a different name."
    );
  }
  if (lower.includes("port is already allocated")) {
    return new Error(
      "That host port is already in use. Pick another port or leave it blank to auto-assign."
    );
  }
  return err instanceof Error ? err : new Error(message);
}
