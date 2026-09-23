import type { ConnectionConfig } from "../types";

/**
 * Saved Docker-linked connections whose containers no longer exist.
 * Only call when Docker is reachable — never treat "daemon down" as orphans.
 */
export function findOrphanedDockerConnectionIds(
  connections: ConnectionConfig[],
  existingContainerNames: ReadonlySet<string> | readonly string[]
): string[] {
  const names =
    existingContainerNames instanceof Set
      ? existingContainerNames
      : new Set(existingContainerNames);

  return connections
    .filter(
      (c) =>
        c.docker?.managed === true &&
        Boolean(c.docker.containerName) &&
        !names.has(c.docker.containerName)
    )
    .map((c) => c.id);
}
