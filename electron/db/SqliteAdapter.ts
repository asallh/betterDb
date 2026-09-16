import fs from "node:fs";
import Database from "better-sqlite3";
import { DatabaseAdapter } from "./DatabaseAdapter";
import type {
  CellUpdate,
  ColumnInfo,
  ConnectionConfig,
  PaginationParams,
  QueryResult,
  RowDelete,
  RowInsert,
  TableInfo,
} from "../../shared/types";

type QueryRow = Record<string, unknown>;

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function qualifiedName(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} kB`;
  return `${value} B`;
}

function inferType(value: unknown): string {
  if (value === null || value === undefined) return "unknown";
  if (Buffer.isBuffer(value)) return "blob";
  return typeof value;
}

export class SqliteAdapter extends DatabaseAdapter {
  private db: Database.Database | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  private get databasePath(): string {
    return this.config.database || this.config.host;
  }

  private all<T extends QueryRow>(sql: string, params: unknown[] = []): T[] {
    if (!this.db) throw new Error("Not connected");
    return this.db.prepare(sql).all(...params) as T[];
  }

  private run(sql: string, params: unknown[] = []): Database.RunResult {
    if (!this.db) throw new Error("Not connected");
    return this.db.prepare(sql).run(...params);
  }

  async connect(): Promise<void> {
    if (!this.databasePath) {
      throw new Error("SQLite database file path is required");
    }
    this.db = new Database(this.databasePath);
    this.db.pragma("foreign_keys = ON");
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.db) throw new Error("Not connected");
    const start = performance.now();

    try {
      const statement = this.db.prepare(sql);
      if (statement.reader) {
        const rows = statement.all() as QueryRow[];
        const columns = statement.columns().map((column) => column.name);
        const firstRow = rows[0];
        return {
          columns,
          columnTypes: columns.map((column) => ({
            name: column,
            dataType: firstRow ? inferType(firstRow[column]) : "unknown",
          })),
          rows,
          rowCount: rows.length,
          durationMs: Math.round(performance.now() - start),
        };
      }

      const result = statement.run();
      return {
        columns: [],
        rows: [],
        rowCount: result.changes,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async getSchemas(): Promise<string[]> {
    const rows = this.all<{ name: string }>("PRAGMA database_list");
    return rows.map((row) => row.name);
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const targetSchema = schema ?? "main";
    const rows = this.all<{ name: string; type: string }>(
      `SELECT name, type
       FROM ${quoteIdent(targetSchema)}.sqlite_schema
       WHERE type IN ('table', 'view')
         AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    );

    return rows.map((row) => ({
      schema: targetSchema,
      name: row.name,
      type: row.type === "view" ? "view" : "table",
    }));
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const columns = this.all<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>(`PRAGMA ${quoteIdent(schema)}.table_info(${quoteString(table)})`);

    const foreignKeys = this.all<{
      from: string;
      table: string;
      to: string;
    }>(`PRAGMA ${quoteIdent(schema)}.foreign_key_list(${quoteString(table)})`);
    const fkMap = new Map(
      foreignKeys.map((row) => [
        row.from,
        { table: row.table, column: row.to },
      ])
    );

    return columns.map((row) => ({
      name: row.name,
      dataType: row.type || "unknown",
      nullable: row.notnull === 0 && row.pk === 0,
      defaultValue: row.dflt_value,
      isPrimaryKey: row.pk > 0,
      isForeignKey: fkMap.has(row.name),
      references: fkMap.get(row.name),
    }));
  }

  async getTableData(
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult> {
    const dir = pagination.orderDir === "DESC" ? "DESC" : "ASC";
    const orderBy = pagination.orderBy ? ` ORDER BY ${quoteIdent(pagination.orderBy)} ${dir}` : "";
    const sql = `SELECT * FROM ${qualifiedName(schema, table)}${orderBy} LIMIT ${Number(
      pagination.limit
    )} OFFSET ${Number(pagination.offset)}`;
    return this.executeQuery(sql);
  }

  async getTableRowCount(schema: string, table: string): Promise<number> {
    const rows = this.all<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${qualifiedName(schema, table)}`
    );
    return Number(rows[0]?.count ?? 0);
  }

  async getPrimaryKeys(schema: string, table: string): Promise<string[]> {
    const columns = this.all<{ name: string; pk: number }>(
      `PRAGMA ${quoteIdent(schema)}.table_info(${quoteString(table)})`
    );
    return columns
      .filter((row) => row.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((row) => row.name);
  }

  async updateCell(update: CellUpdate): Promise<QueryResult> {
    const pkEntries = Object.entries(update.primaryKeys);
    if (pkEntries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No primary key - cannot identify row to update" };
    }

    const values = [update.value === "" ? null : update.value];
    const whereParts = pkEntries.map(([column]) => `${quoteIdent(column)} = ?`);
    pkEntries.forEach(([, value]) => values.push(value));
    const sql = `UPDATE ${qualifiedName(update.schema, update.table)}
                 SET ${quoteIdent(update.column)} = ?
                 WHERE ${whereParts.join(" AND ")}`;
    return this.executeRun(sql, values);
  }

  async deleteRow(params: RowDelete): Promise<QueryResult> {
    const pkEntries = Object.entries(params.primaryKeys);
    if (pkEntries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No primary key - cannot identify row to delete" };
    }

    const values = pkEntries.map(([, value]) => value);
    const whereParts = pkEntries.map(([column]) => `${quoteIdent(column)} = ?`);
    const sql = `DELETE FROM ${qualifiedName(params.schema, params.table)}
                 WHERE ${whereParts.join(" AND ")}`;
    return this.executeRun(sql, values);
  }

  async insertRow(params: RowInsert): Promise<QueryResult> {
    const entries = Object.entries(params.values).filter(([, value]) => value !== undefined && value !== "");
    if (entries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No values provided" };
    }

    const columns = entries.map(([column]) => quoteIdent(column)).join(", ");
    const placeholders = entries.map(() => "?").join(", ");
    const values = entries.map(([, value]) => (value === "" ? null : value));
    const sql = `INSERT INTO ${qualifiedName(params.schema, params.table)} (${columns})
                 VALUES (${placeholders})`;
    return this.executeRun(sql, values);
  }

  private async executeRun(sql: string, params: unknown[]): Promise<QueryResult> {
    const start = performance.now();
    try {
      const result = this.run(sql, params);
      return {
        columns: [],
        rows: [],
        rowCount: result.changes,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return { columns: [], rows: [], rowCount: 0, durationMs: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
    }
  }

  async truncateTable(schema: string, table: string): Promise<QueryResult> {
    return this.executeRun(`DELETE FROM ${qualifiedName(schema, table)}`, []);
  }

  async dropTable(schema: string, table: string, type: "table" | "view"): Promise<QueryResult> {
    const keyword = type === "view" ? "VIEW" : "TABLE";
    return this.executeRun(`DROP ${keyword} ${qualifiedName(schema, table)}`, []);
  }

  async dropSchema(schema: string, cascade: boolean): Promise<QueryResult> {
    if (schema === "main" || schema === "temp") {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        error: `SQLite cannot drop the ${schema} database.`,
      };
    }
    if (cascade) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        error: "SQLite does not support DROP SCHEMA CASCADE.",
      };
    }
    return this.executeRun(`DETACH DATABASE ${quoteIdent(schema)}`, []);
  }

  async getIndexes(
    schema: string,
    table: string
  ): Promise<{ name: string; columns: string; isUnique: boolean; isPrimary: boolean }[]> {
    const indexList = this.all<{
      name: string;
      unique: number;
      origin: string;
    }>(`PRAGMA ${quoteIdent(schema)}.index_list(${quoteString(table)})`);

    return indexList.map((index) => {
      const columns = this.all<{ name: string }>(
        `PRAGMA ${quoteIdent(schema)}.index_info(${quoteString(index.name)})`
      );
      return {
        name: index.name,
        columns: columns.map((column) => quoteIdent(column.name)).join(", "),
        isUnique: index.unique === 1,
        isPrimary: index.origin === "pk",
      };
    });
  }

  async getTableSize(
    schema: string
  ): Promise<{ totalSize: string; dataSize: string; indexSize: string }> {
    const databases = this.all<{ name: string; file: string }>("PRAGMA database_list");
    const databaseFile = databases.find((row) => row.name === schema)?.file;
    const totalSize = databaseFile && fs.existsSync(databaseFile)
      ? formatBytes(fs.statSync(databaseFile).size)
      : "Not available";

    return {
      totalSize,
      dataSize: "Not available",
      indexSize: "Not available",
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    let db: Database.Database | null = null;
    try {
      if (!this.databasePath) {
        throw new Error("SQLite database file path is required");
      }
      db = new Database(this.databasePath);
      db.pragma("foreign_keys = ON");
      db.close();
      return { success: true };
    } catch (e: unknown) {
      db?.close();
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
