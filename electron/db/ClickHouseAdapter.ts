import { createClient, type ClickHouseClient } from "@clickhouse/client";
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
  return `\`${name.replace(/`/g, "``")}\``;
}

function quoteLiteral(value: unknown): string {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "\\'")}'`;
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} kB`;
  return `${value} B`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class ClickHouseAdapter extends DatabaseAdapter {
  private client: ClickHouseClient | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  private buildUrl(): string {
    const protocol = this.config.ssl ? "https" : "http";
    const port = this.config.port || 8123;
    return `${protocol}://${this.config.host}:${port}`;
  }

  private createClickHouseClient(): ClickHouseClient {
    return createClient({
      url: this.buildUrl(),
      username: this.config.user || "default",
      password: this.config.password || "",
      database: this.config.database || "default",
      request_timeout: 30_000,
    });
  }

  private async queryRows<T extends QueryRow>(sql: string): Promise<T[]> {
    if (!this.client) throw new Error("Not connected");
    const result = await this.client.query({
      query: sql,
      format: "JSONEachRow",
    });
    return (await result.json()) as T[];
  }

  private async runCommand(sql: string): Promise<void> {
    if (!this.client) throw new Error("Not connected");
    await this.client.command({ query: sql });
  }

  async connect(): Promise<void> {
    const client = this.createClickHouseClient();
    try {
      await client.ping();
      this.client = client;
    } catch (err) {
      await client.close().catch(() => {});
      this.client = null;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.client) throw new Error("Not connected");
    const start = performance.now();
    const trimmed = sql.trim();
    const isSelectLike = /^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b/i.test(trimmed);

    try {
      if (isSelectLike) {
        const rows = await this.queryRows(sql);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return {
          columns,
          columnTypes: columns.map((name) => ({ name, dataType: "unknown" })),
          rows,
          rowCount: rows.length,
          durationMs: Math.round(performance.now() - start),
        };
      }

      await this.runCommand(sql);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: errorMessage(e),
      };
    }
  }

  async getSchemas(): Promise<string[]> {
    const rows = await this.queryRows<{ name: string }>("SHOW DATABASES");
    return rows
      .map((row) => row.name)
      .filter(
        (name) =>
          name &&
          !["system", "INFORMATION_SCHEMA", "information_schema"].includes(name)
      )
      .sort((a, b) => a.localeCompare(b));
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const database = schema ?? this.config.database ?? "default";

    try {
      const rows = await this.queryRows<{ name: string; engine?: string }>(
        `SHOW TABLES FROM ${quoteIdent(database)}`
      );
      return rows.map((row) => ({
        schema: database,
        name: row.name,
        type: String(row.engine ?? "").toLowerCase().includes("view") ? "view" : "table",
      }));
    } catch {
      const rows = await this.queryRows<{
        database: string;
        name: string;
        engine: string;
      }>(
        `SELECT database, name, engine
         FROM system.tables
         WHERE database = ${quoteLiteral(database)}
         ORDER BY name`
      );
      return rows.map((row) => ({
        schema: row.database,
        name: row.name,
        type: String(row.engine).toLowerCase().includes("view") ? "view" : "table",
      }));
    }
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const rows = await this.queryRows<{
      name: string;
      type: string;
      default_expression: string;
      is_in_primary_key: number | boolean;
    }>(
      `SELECT name, type, default_expression, is_in_primary_key
       FROM system.columns
       WHERE database = ${quoteLiteral(schema)}
         AND table = ${quoteLiteral(table)}
       ORDER BY position`
    );

    return rows.map((row) => ({
      name: row.name,
      dataType: row.type,
      nullable: String(row.type).includes("Nullable"),
      defaultValue: row.default_expression || null,
      isPrimaryKey: Boolean(row.is_in_primary_key),
      isForeignKey: false,
    }));
  }

  async getTableData(
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult> {
    const tableName = `${quoteIdent(schema)}.${quoteIdent(table)}`;
    const dir = pagination.orderDir === "DESC" ? "DESC" : "ASC";
    const orderBy = pagination.orderBy ? ` ORDER BY ${quoteIdent(pagination.orderBy)} ${dir}` : "";
    const sql = `SELECT * FROM ${tableName}${orderBy} LIMIT ${Number(
      pagination.limit
    )} OFFSET ${Number(pagination.offset)}`;
    return this.executeQuery(sql);
  }

  async getTableRowCount(schema: string, table: string): Promise<number> {
    const tableName = `${quoteIdent(schema)}.${quoteIdent(table)}`;
    const rows = await this.queryRows<{ count: string | number }>(
      `SELECT count() AS count FROM ${tableName}`
    );
    return Number(rows[0]?.count ?? 0);
  }

  async getPrimaryKeys(schema: string, table: string): Promise<string[]> {
    const rows = await this.queryRows<{ name: string; is_in_primary_key: number | boolean }>(
      `SELECT name, is_in_primary_key
       FROM system.columns
       WHERE database = ${quoteLiteral(schema)}
         AND table = ${quoteLiteral(table)}
         AND is_in_primary_key = 1
       ORDER BY position`
    );
    return rows.map((row) => row.name);
  }

  async updateCell(update: CellUpdate): Promise<QueryResult> {
    if (!this.client) throw new Error("Not connected");
    const pkEntries = Object.entries(update.primaryKeys);
    if (pkEntries.length === 0) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        error: "No primary key - cannot identify row to update",
      };
    }

    const whereParts = pkEntries.map(
      ([column, value]) => `${quoteIdent(column)} = ${quoteLiteral(value)}`
    );
    const sql = `ALTER TABLE ${quoteIdent(update.schema)}.${quoteIdent(update.table)}
                 UPDATE ${quoteIdent(update.column)} = ${quoteLiteral(update.value === "" ? null : update.value)}
                 WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();
    try {
      await this.runCommand(sql);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error:
          errorMessage(e) ||
          "ClickHouse cell editing is not supported in BetterDB yet",
      };
    }
  }

  async deleteRow(params: RowDelete): Promise<QueryResult> {
    if (!this.client) throw new Error("Not connected");
    const pkEntries = Object.entries(params.primaryKeys);
    if (pkEntries.length === 0) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        error: "No primary key - cannot identify row to delete",
      };
    }

    const whereParts = pkEntries.map(
      ([column, value]) => `${quoteIdent(column)} = ${quoteLiteral(value)}`
    );
    const sql = `ALTER TABLE ${quoteIdent(params.schema)}.${quoteIdent(params.table)}
                 DELETE WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();
    try {
      await this.runCommand(sql);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: errorMessage(e),
      };
    }
  }

  async insertRow(params: RowInsert): Promise<QueryResult> {
    if (!this.client) throw new Error("Not connected");
    const entries = Object.entries(params.values).filter(
      ([, value]) => value !== undefined && value !== ""
    );
    if (entries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No values provided" };
    }

    const columns = entries.map(([column]) => quoteIdent(column)).join(", ");
    const values = entries.map(([, value]) => quoteLiteral(value === "" ? null : value)).join(", ");
    const sql = `INSERT INTO ${quoteIdent(params.schema)}.${quoteIdent(params.table)} (${columns})
                 VALUES (${values})`;
    const start = performance.now();
    try {
      await this.runCommand(sql);
      return {
        columns: [],
        rows: [],
        rowCount: 1,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: errorMessage(e),
      };
    }
  }

  async truncateTable(schema: string, table: string): Promise<QueryResult> {
    return this.executeQuery(`TRUNCATE TABLE ${quoteIdent(schema)}.${quoteIdent(table)}`);
  }

  async dropTable(schema: string, table: string, type: "table" | "view"): Promise<QueryResult> {
    const keyword = type === "view" ? "VIEW" : "TABLE";
    return this.executeQuery(`DROP ${keyword} IF EXISTS ${quoteIdent(schema)}.${quoteIdent(table)}`);
  }

  async dropSchema(schema: string, cascade: boolean): Promise<QueryResult> {
    void cascade;
    return this.executeQuery(`DROP DATABASE IF EXISTS ${quoteIdent(schema)}`);
  }

  async getIndexes(
    _schema: string,
    _table: string
  ): Promise<{ name: string; columns: string; isUnique: boolean; isPrimary: boolean }[]> {
    void _schema;
    void _table;
    return [];
  }

  async getTableSize(
    schema: string,
    table: string
  ): Promise<{ totalSize: string; dataSize: string; indexSize: string }> {
    try {
      const rows = await this.queryRows<{ bytes: string | number }>(
        `SELECT sum(bytes_on_disk) AS bytes
         FROM system.parts
         WHERE database = ${quoteLiteral(schema)}
           AND table = ${quoteLiteral(table)}
           AND active`
      );
      const bytes = Number(rows[0]?.bytes ?? 0);
      const formatted = formatBytes(bytes);
      return { totalSize: formatted, dataSize: formatted, indexSize: "—" };
    } catch {
      return { totalSize: "—", dataSize: "—", indexSize: "—" };
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const client = this.createClickHouseClient();
    try {
      await client.ping();
      const result = await client.query({
        query: "SELECT 1",
        format: "JSONEachRow",
      });
      await result.json();
      await client.close();
      return { success: true };
    } catch (e: unknown) {
      await client.close().catch(() => {});
      return { success: false, error: errorMessage(e) };
    }
  }
}
