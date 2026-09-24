/** Sanitize a display name into a Docker-safe slug. */
export function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "db";
}

/** Container name: betterdb-{slug} */
export function containerNameFromDisplay(name: string): string {
  return `betterdb-${slugifyName(name)}`;
}

/** Named volume for a managed container. */
export function volumeNameFromContainer(containerName: string): string {
  return `${containerName}-data`;
}

export const MANAGED_LABEL = "betterdb.managed";
export const MANAGED_LABEL_VALUE = "true";
export const ENGINE_LABEL = "betterdb.engine";
export const CONNECTION_ID_LABEL = "betterdb.connectionId";

export function stripContainerSlash(name: string): string {
  return name.replace(/^\//, "");
}

/** True only for containers BetterDB created (name prefix + managed label). */
export function isManagedContainer(
  name: string,
  labels?: Record<string, string> | null
): boolean {
  const bare = stripContainerSlash(name);
  return (
    bare.startsWith("betterdb-") &&
    labels?.[MANAGED_LABEL] === MANAGED_LABEL_VALUE
  );
}

export function assertManagedContainer(
  name: string,
  labels?: Record<string, string> | null
): void {
  if (!isManagedContainer(name, labels)) {
    throw new Error(
      "Refusing to manage a container that was not created by BetterDB"
    );
  }
}
