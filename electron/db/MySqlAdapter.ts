import mysql from "mysql2/promise";
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

function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} kB`;
  return `${value} B`;
}

function isResultSetHeader(value: unknown): value is mysql.ResultSetHeader {
  return typeof value === "object" && value !== null && "affectedRows" in value;
}

export class MySqlAdapter extends DatabaseAdapter {
  protected pool: mysql.Pool | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  private buildConfig(): mysql.PoolOptions {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database || undefined,
      user: this.config.user,
      password: this.config.password,
      waitForConnections: true,
      connectionLimit: 3,
      ssl: this.config.ssl
        ? { rejectUnauthorized: this.config.sslRejectUnauthorized !== false }
        : undefined,
    };
  }

  protected async query<T extends QueryRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<[T[], mysql.FieldPacket[]]> {
    if (!this.pool) throw new Error("Not connected");
    const [rows, fields] = await this.pool.query<T[] & mysql.RowDataPacket[]>(sql, params);
    return [Array.isArray(rows) ? rows : [], fields];
  }

  async connect(): Promise<void> {
    this.pool = mysql.createPool(this.buildConfig());
    try {
      const connection = await this.pool.getConnection();
      connection.release();
    } catch (err) {
      await this.pool.end().catch(() => {});
      this.pool = null;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.pool) throw new Error("Not connected");
    const start = performance.now();

    try {
      const [rows, fields] = await this.pool.query(sql);
      const durationMs = Math.round(performance.now() - start);

      if (Array.isArray(rows)) {
        const typedRows = rows as QueryRow[];
        return {
          columns: fields.map((field) => field.name),
          columnTypes: fields.map((field) => ({
            name: field.name,
            dataType: field.typeName ?? String(field.columnType),
          })),
          rows: typedRows,
          rowCount: typedRows.length,
          durationMs,
        };
      }

      return {
        columns: [],
        rows: [],
        rowCount: isResultSetHeader(rows) ? rows.affectedRows : 0,
        durationMs,
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
    const [rows] = await this.query<{ schema_name: string }>(
      `SELECT SCHEMA_NAME AS schema_name
       FROM information_schema.SCHEMATA
       WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
       ORDER BY SCHEMA_NAME`
    );
    return rows.map((row) => row.schema_name);
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const targetSchema = schema ?? this.config.database;
    const [rows] = await this.query<{
      table_schema: string;
      table_name: string;
      table_type: string;
    }>(
      `SELECT TABLE_SCHEMA AS table_schema,
              TABLE_NAME AS table_name,
              TABLE_TYPE AS table_type
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [targetSchema]
    );

    return rows.map((row) => ({
      schema: row.table_schema,
      name: row.table_name,
      type: row.table_type === "VIEW" ? "view" : "table",
    }));
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const [columns] = await this.query<{
      column_name: string;
      column_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT COLUMN_NAME AS column_name,
              COLUMN_TYPE AS column_type,
              IS_NULLABLE AS is_nullable,
              COLUMN_DEFAULT AS column_default
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [schema, table]
    );

    const [primaryKeys] = await this.query<{ column_name: string }>(
      `SELECT COLUMN_NAME AS column_name
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = ?
         AND CONSTRAINT_NAME = 'PRIMARY'
       ORDER BY ORDINAL_POSITION`,
      [schema, table]
    );
    const pkColumns = new Set(primaryKeys.map((row) => row.column_name));

    const [foreignKeys] = await this.query<{
      column_name: string;
      foreign_table: string;
      foreign_column: string;
    }>(
      `SELECT COLUMN_NAME AS column_name,
              REFERENCED_TABLE_NAME AS foreign_table,
              REFERENCED_COLUMN_NAME AS foreign_column
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [schema, table]
    );
    const fkMap = new Map(
      foreignKeys.map((row) => [
        row.column_name,
        { table: row.foreign_table, column: row.foreign_column },
      ])
    );

    return columns.map((row) => ({
      name: row.column_name,
      dataType: row.column_type,
      nullable: row.is_nullable === "YES",
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
    const [rows] = await this.query<{ count: number }>(`SELECT COUNT(*) AS count FROM ${tableName}`);
    return Number(rows[0]?.count ?? 0);
  }

  async getPrimaryKeys(schema: string, table: string): Promise<string[]> {
    const [rows] = await this.query<{ column_name: string }>(
      `SELECT COLUMN_NAME AS column_name
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = ?
         AND CONSTRAINT_NAME = 'PRIMARY'
       ORDER BY ORDINAL_POSITION`,
      [schema, table]
    );
    return rows.map((row) => row.column_name);
  }

  async updateCell(update: CellUpdate): Promise<QueryResult> {
    if (!this.pool) throw new Error("Not connected");
    const pkEntries = Object.entries(update.primaryKeys);
    if (pkEntries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No primary key - cannot identify row to update" };
    }

    const values = [update.value === "" ? null : update.value];
    const whereParts = pkEntries.map(([column]) => `${quoteIdent(column)} = ?`);
    pkEntries.forEach(([, value]) => values.push(value));

    const sql = `UPDATE ${quoteIdent(update.schema)}.${quoteIdent(update.table)}
                 SET ${quoteIdent(update.column)} = ?
                 WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();
    try {
      const [result] = await this.pool.query(sql, values);
      return {
        columns: [],
        rows: [],
        rowCount: isResultSetHeader(result) ? result.affectedRows : 0,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return { columns: [], rows: [], rowCount: 0, durationMs: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
    }
  }

  async deleteRow(params: RowDelete): Promise<QueryResult> {
    if (!this.pool) throw new Error("Not connected");
    const pkEntries = Object.entries(params.primaryKeys);
    if (pkEntries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No primary key - cannot identify row to delete" };
    }

    const values = pkEntries.map(([, value]) => value);
    const whereParts = pkEntries.map(([column]) => `${quoteIdent(column)} = ?`);
    const sql = `DELETE FROM ${quoteIdent(params.schema)}.${quoteIdent(params.table)}
                 WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();
    try {
      const [result] = await this.pool.query(sql, values);
      return {
        columns: [],
        rows: [],
        rowCount: isResultSetHeader(result) ? result.affectedRows : 0,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return { columns: [], rows: [], rowCount: 0, durationMs: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
    }
  }

  async insertRow(params: RowInsert): Promise<QueryResult> {
    if (!this.pool) throw new Error("Not connected");
    const entries = Object.entries(params.values).filter(([, value]) => value !== undefined && value !== "");
    if (entries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No values provided" };
    }

    const columns = entries.map(([column]) => quoteIdent(column)).join(", ");
    const placeholders = entries.map(() => "?").join(", ");
    const values = entries.map(([, value]) => (value === "" ? null : value));
    const sql = `INSERT INTO ${quoteIdent(params.schema)}.${quoteIdent(params.table)} (${columns})
                 VALUES (${placeholders})`;
    const start = performance.now();
    try {
      const [result] = await this.pool.query(sql, values);
      return {
        columns: [],
        rows: [],
        rowCount: isResultSetHeader(result) ? result.affectedRows : 0,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return { columns: [], rows: [], rowCount: 0, durationMs: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
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
    if (cascade) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        error: "MySQL and MariaDB do not support DROP DATABASE CASCADE.",
      };
    }
    return this.executeQuery(`DROP DATABASE ${quoteIdent(schema)}`);
  }

  async getIndexes(
    schema: string,
    table: string
  ): Promise<{ name: string; columns: string; isUnique: boolean; isPrimary: boolean }[]> {
    const [rows] = await this.query<{
      index_name: string;
      column_name: string;
      non_unique: number;
      seq_in_index: number;
    }>(
      `SELECT INDEX_NAME AS index_name,
              COLUMN_NAME AS column_name,
              NON_UNIQUE AS non_unique,
              SEQ_IN_INDEX AS seq_in_index
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [schema, table]
    );

    const indexes = new Map<string, { columns: string[]; isUnique: boolean; isPrimary: boolean }>();
    for (const row of rows) {
      const existing =
        indexes.get(row.index_name) ??
        {
          columns: [],
          isUnique: row.non_unique === 0,
          isPrimary: row.index_name === "PRIMARY",
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
  }

  async getTableSize(
    schema: string,
    table: string
  ): Promise<{ totalSize: string; dataSize: string; indexSize: string }> {
    const [rows] = await this.query<{
      data_length: number | null;
      index_length: number | null;
    }>(
      `SELECT DATA_LENGTH AS data_length,
              INDEX_LENGTH AS index_length
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [schema, table]
    );
    const dataLength = Number(rows[0]?.data_length ?? 0);
    const indexLength = Number(rows[0]?.index_length ?? 0);
    return {
      totalSize: formatBytes(dataLength + indexLength),
      dataSize: formatBytes(dataLength),
      indexSize: formatBytes(indexLength),
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const pool = mysql.createPool({
      ...this.buildConfig(),
      connectionLimit: 1,
      connectTimeout: 5000,
    });
    try {
      const connection = await pool.getConnection();
      connection.release();
      await pool.end();
      return { success: true };
    } catch (e: unknown) {
      await pool.end().catch(() => {});
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
