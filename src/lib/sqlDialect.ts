import type { ConnectionConfig } from "../../shared/types";

export type SqlDialectEngine = ConnectionConfig["engine"];

export function isSqlServer(engine: SqlDialectEngine | undefined): boolean {
  return engine === "sqlserver";
}

export function isMySqlLike(engine: SqlDialectEngine | undefined): boolean {
  return engine === "mysql" || engine === "mariadb";
}

export function isOracle(engine: SqlDialectEngine | undefined): boolean {
  return engine === "oracle";
}

export function supportsDropSchemaCascade(engine: SqlDialectEngine | undefined): boolean {
  return !isSqlServer(engine) && !isMySqlLike(engine) && engine !== "sqlite";
}

export function quoteIdentifier(
  identifier: string,
  engine: SqlDialectEngine | undefined
): string {
  if (isSqlServer(engine)) {
    return `[${identifier.replace(/]/g, "]]")}]`;
  }

  if (isMySqlLike(engine)) {
    return `\`${identifier.replace(/`/g, "``")}\``;
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
  if (isSqlServer(engine)) return `@p${index}`;
  if (isMySqlLike(engine) || engine === "sqlite") return "?";
  if (isOracle(engine)) return `:p${index}`;
  return `$${index}`;
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

  if (isOracle(engine)) {
    return `SELECT *\nFROM ${tableName}\nFETCH FIRST ${limit} ROWS ONLY;`;
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

  if (isOracle(engine)) {
    return `SELECT\n${columnNames}\nFROM ${tableName}\nFETCH FIRST ${limit} ROWS ONLY;`;
  }

  return `SELECT\n${columnNames}\nFROM ${tableName}\nLIMIT ${limit};`;
}
