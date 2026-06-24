import type { ConnectionConfig } from "../../shared/types";

export type SqlDialectEngine = ConnectionConfig["engine"];

export function isSqlServer(engine: SqlDialectEngine | undefined): boolean {
  return engine === "sqlserver";
}

export function quoteIdentifier(
  identifier: string,
  engine: SqlDialectEngine | undefined
): string {
  if (isSqlServer(engine)) {
    return `[${identifier.replace(/]/g, "]]")}]`;
  }

  return `"${identifier.replace(/"/g, '""')}"`;
}

export function qualifiedName(
  schema: string,
  name: string,
  engine: SqlDialectEngine | undefined
): string {
  return `${quoteIdentifier(schema, engine)}.${quoteIdentifier(name, engine)}`;
}

export function parameterPlaceholder(
  index: number,
  engine: SqlDialectEngine | undefined
): string {
  return isSqlServer(engine) ? `@p${index}` : `$${index}`;
}

export function selectAllSql(
  schema: string,
  table: string,
  engine: SqlDialectEngine | undefined,
  limit = 100
): string {
  const tableName = qualifiedName(schema, table, engine);
  if (isSqlServer(engine)) {
    return `SELECT TOP (${limit}) *\nFROM ${tableName};`;
  }

  return `SELECT *\nFROM ${tableName}\nLIMIT ${limit};`;
}

export function selectColumnsSql(
  schema: string,
  table: string,
  columns: string[],
  engine: SqlDialectEngine | undefined,
  limit = 100
): string {
  const columnNames = columns
    .map((column) => `  ${quoteIdentifier(column, engine)}`)
    .join(",\n");
  const tableName = qualifiedName(schema, table, engine);

  if (isSqlServer(engine)) {
    return `SELECT TOP (${limit})\n${columnNames}\nFROM ${tableName};`;
  }

  return `SELECT\n${columnNames}\nFROM ${tableName}\nLIMIT ${limit};`;
}
