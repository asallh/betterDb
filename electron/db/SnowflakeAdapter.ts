import snowflake from "snowflake-sdk";
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

function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} kB`;
  return `${value} B`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class SnowflakeAdapter extends DatabaseAdapter {
  private connection: snowflake.Connection | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  private buildConnectionOptions(): snowflake.ConnectionOptions {
    return {
      account: this.config.account || this.config.host,
      username: this.config.user,
      password: this.config.password,
      warehouse: this.config.warehouse || undefined,
      database: this.config.database || undefined,
      role: this.config.role || undefined,
    };
  }

  private createConnection(): snowflake.Connection {
    return snowflake.createConnection(this.buildConnectionOptions());
  }

  private connectConnection(connection: snowflake.Connection): Promise<void> {
    return new Promise((resolve, reject) => {
      connection.connect((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private destroyConnection(connection: snowflake.Connection): Promise<void> {
    return new Promise((resolve) => {
      connection.destroy((err) => {
        void err;
        resolve();
      });
    });
  }

  private toBind(value: unknown): snowflake.Bind {
    if (value === null || value === undefined) {
      return null as unknown as snowflake.Bind;
    }
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    if (typeof value === "bigint") {
      return Number(value);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  }

  private executeStatement<T extends QueryRow = QueryRow>(
    sql: string,
    binds: snowflake.Bind[] = []
  ): Promise<{ rows: T[]; columns: string[]; columnTypes: { name: string; dataType: string }[]; rowCount: number }> {
    if (!this.connection) throw new Error("Not connected");
    const connection = this.connection;

    return new Promise((resolve, reject) => {
      connection.execute({
        sqlText: sql,
        binds,
        complete: (err, stmt, rows) => {
          if (err) {
            reject(err);
            return;
          }

          const columnsMeta = stmt.getColumns() ?? [];
          const columns = columnsMeta.map((col) => col.getName());
          const columnTypes = columnsMeta.map((col) => ({
            name: col.getName(),
            dataType: col.getType() || "unknown",
          }));
          const typedRows = (rows ?? []) as T[];

          resolve({
            rows: typedRows,
            columns,
            columnTypes,
            rowCount: typedRows.length || stmt.getNumRows() || 0,
          });
        },
      });
    });
  }

  private async query<T extends QueryRow>(sql: string, binds: snowflake.Bind[] = []): Promise<T[]> {
    const result = await this.executeStatement<T>(sql, binds);
    return result.rows;
  }

  async connect(): Promise<void> {
    const connection = this.createConnection();
    try {
      await this.connectConnection(connection);
      this.connection = connection;
    } catch (err) {
      await this.destroyConnection(connection);
      this.connection = null;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.destroyConnection(this.connection);
      this.connection = null;
    }
  }

  isConnected(): boolean {
    return this.connection !== null;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.connection) throw new Error("Not connected");
    const start = performance.now();

    try {
      const result = await this.executeStatement(sql);
      return {
        columns: result.columns,
        columnTypes: result.columnTypes,
        rows: result.rows,
        rowCount: result.rowCount,
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
    try {
      const rows = await this.query<{ name?: string; NAME?: string }>("SHOW SCHEMAS");
      const names = rows
        .map((row) => String(row.name ?? row.NAME ?? ""))
        .filter((name) => name && name.toUpperCase() !== "INFORMATION_SCHEMA");
      if (names.length > 0) return names.sort((a, b) => a.localeCompare(b));
    } catch {
      // Fall through to INFORMATION_SCHEMA.
    }

    const rows = await this.query<{ schema_name: string }>(
      `SELECT SCHEMA_NAME AS schema_name
       FROM INFORMATION_SCHEMA.SCHEMATA
       WHERE SCHEMA_NAME <> 'INFORMATION_SCHEMA'
       ORDER BY SCHEMA_NAME`
    );
    return rows.map((row) => row.schema_name);
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const targetSchema = schema ?? this.config.database;
    if (!targetSchema) return [];

    const rows = await this.query<{
      table_schema: string;
      table_name: string;
      table_type: string;
    }>(
      `SELECT TABLE_SCHEMA AS table_schema,
              TABLE_NAME AS table_name,
              TABLE_TYPE AS table_type
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [targetSchema]
    );

    return rows.map((row) => ({
      schema: row.table_schema,
      name: row.table_name,
      type: String(row.table_type).toUpperCase().includes("VIEW") ? "view" : "table",
    }));
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const columns = await this.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT COLUMN_NAME AS column_name,
              DATA_TYPE AS data_type,
              IS_NULLABLE AS is_nullable,
              COLUMN_DEFAULT AS column_default
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [schema, table]
    );

    const primaryKeys = await this.getPrimaryKeys(schema, table);
    const pkColumns = new Set(primaryKeys);

    let fkMap = new Map<string, { table: string; column: string }>();
    try {
      const foreignKeys = await this.query<{
        column_name: string;
        foreign_table: string;
        foreign_column: string;
      }>(
        `SELECT kcu.COLUMN_NAME AS column_name,
                kcu.REFERENCED_TABLE_NAME AS foreign_table,
                kcu.REFERENCED_COLUMN_NAME AS foreign_column
         FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
         JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
           ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
         WHERE kcu.TABLE_SCHEMA = ?
           AND kcu.TABLE_NAME = ?
           AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
        [schema, table]
      );
      fkMap = new Map(
        foreignKeys.map((row) => [
          row.column_name,
          { table: row.foreign_table, column: row.foreign_column },
        ])
      );
    } catch {
      fkMap = new Map();
    }

    return columns.map((row) => ({
      name: row.column_name,
      dataType: row.data_type,
      nullable: String(row.is_nullable).toUpperCase() === "YES",
      defaultValue: row.column_default,
      isPrimaryKey: pkColumns.has(row.column_name),
      isForeignKey: fkMap.has(row.column_name),
      references: fkMap.get(row.column_name),
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
    const rows = await this.query<{ count: number }>(`SELECT COUNT(*) AS count FROM ${tableName}`);
    return Number(rows[0]?.count ?? 0);
  }

  async getPrimaryKeys(schema: string, table: string): Promise<string[]> {
    try {
      const rows = await this.query<{ column_name: string }>(
        `SELECT COLUMN_NAME AS column_name
         FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
         JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
           ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
         WHERE tc.TABLE_SCHEMA = ?
           AND tc.TABLE_NAME = ?
           AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
         ORDER BY kcu.ORDINAL_POSITION`,
        [schema, table]
      );
      return rows.map((row) => row.column_name);
    } catch {
      return [];
    }
  }

  async updateCell(update: CellUpdate): Promise<QueryResult> {
    if (!this.connection) throw new Error("Not connected");
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

    const binds: snowflake.Bind[] = [
      this.toBind(update.value === "" ? null : update.value),
      ...pkEntries.map(([, value]) => this.toBind(value)),
    ];
    const whereParts = pkEntries.map(([column]) => `${quoteIdent(column)} = ?`);

    const sql = `UPDATE ${quoteIdent(update.schema)}.${quoteIdent(update.table)}
                 SET ${quoteIdent(update.column)} = ?
                 WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();
    try {
      const result = await this.executeStatement(sql, binds);
      return {
        columns: [],
        rows: [],
        rowCount: result.rowCount,
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

  async deleteRow(params: RowDelete): Promise<QueryResult> {
    if (!this.connection) throw new Error("Not connected");
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

    const binds: snowflake.Bind[] = pkEntries.map(([, value]) => this.toBind(value));
    const whereParts = pkEntries.map(([column]) => `${quoteIdent(column)} = ?`);
    const sql = `DELETE FROM ${quoteIdent(params.schema)}.${quoteIdent(params.table)}
                 WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();
    try {
      const result = await this.executeStatement(sql, binds);
      return {
        columns: [],
        rows: [],
        rowCount: result.rowCount,
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
    if (!this.connection) throw new Error("Not connected");
    const entries = Object.entries(params.values).filter(
      ([, value]) => value !== undefined && value !== ""
    );
    if (entries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No values provided" };
    }

    const columns = entries.map(([column]) => quoteIdent(column)).join(", ");
    const placeholders = entries.map(() => "?").join(", ");
    const binds: snowflake.Bind[] = entries.map(([, value]) =>
      this.toBind(value === "" ? null : value)
    );
    const sql = `INSERT INTO ${quoteIdent(params.schema)}.${quoteIdent(params.table)} (${columns})
                 VALUES (${placeholders})`;
    const start = performance.now();
    try {
      const result = await this.executeStatement(sql, binds);
      return {
        columns: [],
        rows: [],
        rowCount: result.rowCount,
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
    return this.executeQuery(`DROP ${keyword} ${quoteIdent(schema)}.${quoteIdent(table)}`);
  }

  async dropSchema(schema: string, cascade: boolean): Promise<QueryResult> {
    const cascadeSql = cascade ? " CASCADE" : "";
    return this.executeQuery(`DROP SCHEMA ${quoteIdent(schema)}${cascadeSql}`);
  }

  async getIndexes(
    schema: string,
    table: string
  ): Promise<{ name: string; columns: string; isUnique: boolean; isPrimary: boolean }[]> {
    try {
      const rows = await this.query<QueryRow>(
        `SHOW INDEXES IN TABLE ${quoteIdent(schema)}.${quoteIdent(table)}`
      );
      return rows.map((row) => {
        const name = String(row.name ?? row.NAME ?? row["index_name"] ?? "index");
        const columns = String(row.columns ?? row.COLUMNS ?? row["column_name"] ?? "");
        const uniqueFlag = row["is_unique"] ?? row.IS_UNIQUE ?? row.unique ?? row.UNIQUE;
        return {
          name,
          columns,
          isUnique: Boolean(uniqueFlag) || String(uniqueFlag).toUpperCase() === "TRUE",
          isPrimary: name.toUpperCase() === "PRIMARY" || name.toUpperCase().includes("PRIMARY"),
        };
      });
    } catch {
      try {
        const rows = await this.query<{
          index_name: string;
          column_name: string;
          is_unique: string | boolean;
        }>(
          `SELECT INDEX_NAME AS index_name,
                  COLUMN_NAME AS column_name,
                  IS_UNIQUE AS is_unique
           FROM INFORMATION_SCHEMA.INDEXES
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           ORDER BY INDEX_NAME`,
          [schema, table]
        );

        const indexes = new Map<
          string,
          { columns: string[]; isUnique: boolean; isPrimary: boolean }
        >();
        for (const row of rows) {
          const existing =
            indexes.get(row.index_name) ??
            {
              columns: [],
              isUnique:
                row.is_unique === true || String(row.is_unique).toUpperCase() === "YES",
              isPrimary: row.index_name.toUpperCase().includes("PRIMARY"),
            };
          existing.columns.push(quoteIdent(row.column_name));
          indexes.set(row.index_name, existing);
        }

        return Array.from(indexes.entries()).map(([name, index]) => ({
          name,
          columns: index.columns.join(", "),
          isUnique: index.isUnique,
          isPrimary: index.isPrimary,
        }));
      } catch {
        return [];
      }
    }
  }

  async getTableSize(
    schema: string,
    table: string
  ): Promise<{ totalSize: string; dataSize: string; indexSize: string }> {
    try {
      const rows = await this.query<{ bytes: number | null }>(
        `SELECT BYTES AS bytes
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [schema, table]
      );
      const bytes = Number(rows[0]?.bytes ?? 0);
      if (!Number.isFinite(bytes) || bytes <= 0) {
        return { totalSize: "—", dataSize: "—", indexSize: "—" };
      }
      const formatted = formatBytes(bytes);
      return { totalSize: formatted, dataSize: formatted, indexSize: "—" };
    } catch {
      return { totalSize: "—", dataSize: "—", indexSize: "—" };
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const connection = this.createConnection();
    try {
      await this.connectConnection(connection);
      await new Promise<void>((resolve, reject) => {
        connection.execute({
          sqlText: "SELECT 1",
          complete: (err) => {
            if (err) reject(err);
            else resolve();
          },
        });
      });
      await this.destroyConnection(connection);
      return { success: true };
    } catch (e: unknown) {
      await this.destroyConnection(connection);
      return { success: false, error: errorMessage(e) };
    }
  }
}
