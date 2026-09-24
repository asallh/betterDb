import type { ConnectionConfig } from "../../../shared/types";

/** Build a duplicated connection config with a new id and "(copy)" name.
 * Docker metadata is stripped — a copy must not share a managed container.
 */
export function buildDuplicatedConnection(
  source: ConnectionConfig,
  newId: string = crypto.randomUUID()
): ConnectionConfig {
  const { docker: _docker, ...rest } = source;
  return {
    ...rest,
    id: newId,
    name: `${source.name} (copy)`,
  };
}
