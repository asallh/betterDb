import type { ConnectionConfig } from "../../../shared/types";

/** Build a duplicated connection config with a new id and "(copy)" name. */
export function buildDuplicatedConnection(
  source: ConnectionConfig,
  newId: string = crypto.randomUUID()
): ConnectionConfig {
  return {
    ...source,
    id: newId,
    name: `${source.name} (copy)`,
  };
}
