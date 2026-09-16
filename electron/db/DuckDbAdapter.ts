import duckdb from "duckdb";
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

type DuckConnection = {
  all: (
    sql: string,
    ...args: unknown[]
  ) => void;
  run: (
    sql: string,
    ...args: unknown[]
  ) => void;
  close: (callback?: (err: Error | null) => void) => void;
};

type DuckDatabase = {
  connect: () => DuckConnection;
  close: (callback?: (err: Error | null) => void) => void;
};

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function qualifiedName(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

function inferType(value: unknown): string {
  if (value === null || value === undefined) return "unknown";
  if (Buffer.isBuffer(value)) return "blob";
  if (value instanceof Date) return "timestamp";
  if (Array.isArray(value)) return "list";
  if (typeof value === "object") return "struct";
  return typeof value;
}

function isSelectLike(sql: string): boolean {
  const trimmed = sql
    .trim()
    .replace(/^\/\*[\s\S]*?\*\//, "")
    .replace(/^--[^\n]*\n?/gm, "")
    .trim();
  return /^(SELECT|WITH|SHOW|DESCRIBE|DESC|EXPLAIN|PRAGMA|CALL|FROM|VALUES|PIVOT|UNPIVOT|SUMMARIZE)\b/i.test(
    trimmed
  );
}

export class DuckDbAdapter extends DatabaseAdapter {
  private db: DuckDatabase | null = null;
  private conn: DuckConnection | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  private get databasePath(): string {
    const path =
      this.config.database ||
      this.config.host ||
      this.config.filePath ||
      "";
    return path.trim() || ":memory:";
  }

  private all<T extends QueryRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.conn) {
        reject(new Error("Not connected"));
        return;
      }
      this.conn.all(sql, ...params, (err: Error | null, rows: T[]) => {
        if (err) reject(err);
        else resolve(rows ?? []);
      });
    });
  }

  private run(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.conn) {
        reject(new Error("Not connected"));
        return;
      }
      this.conn.run(sql, ...params, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private closeConnection(conn: DuckConnection | null): Promise<void> {
    if (!conn) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        conn.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  private closeDatabase(db: DuckDatabase | null): Promise<void> {
    if (!db) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        db.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  async connect(): Promise<void> {
    const path = this.databasePath;
    const db = new duckdb.Database(path) as unknown as DuckDatabase;
    const conn = db.connect();
    try {
      await new Promise<void>((resolve, reject) => {
        conn.all("SELECT 1 AS ok", (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (err) {
      await this.closeConnection(conn);
      await this.closeDatabase(db);
      throw err;
    }
    this.db = db;
    this.conn = conn;
  }

  async disconnect(): Promise<void> {
    const conn = this.conn;
    const db = this.db;
    this.conn = null;
    this.db = null;
    await this.closeConnection(conn);
    await this.closeDatabase(db);
  }

  isConnected(): boolean {
    return this.conn !== null && this.db !== null;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.conn) throw new Error("Not connected");
    const start = performance.now();

    try {
      if (isSelectLike(sql)) {
        const rows = await this.all<QueryRow>(sql);
        const columns =
          rows.length > 0
            ? Object.keys(rows[0])
            : [];
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

      await this.run(sql);
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
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async getSchemas(): Promise<string[]> {
    const rows = await this.all<{ schema_name: string }>(
      `SELECT schema_name
       FROM information_schema.schemata
       WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
       ORDER BY schema_name`
    );
    return rows.map((row) => row.schema_name);
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const targetSchema = schema ?? "main";
    const rows = await this.all<{
      table_schema: string;
      table_name: string;
      table_type: string;
    }>(
      `SELECT table_schema, table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = ?
       ORDER BY table_name`,
      [targetSchema]
    );

    return rows.map((row) => ({
      schema: row.table_schema,
      name: row.table_name,
      type: String(row.table_type).toUpperCase().includes("VIEW") ? "view" : "table",
    }));
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const columns = await this.all<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      character_maximum_length: number | null;
    }>(
      `SELECT column_name,
              data_type,
              is_nullable,
              column_default,
              character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ordinal_position`,
      [schema, table]
    );

    const primaryKeys = await this.all<{ column_name: string }>(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_schema = kcu.constraint_schema
        AND tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = ?
         AND tc.table_name = ?
       ORDER BY kcu.ordinal_position`,
      [schema, table]
    ).catch(() => [] as { column_name: string }[]);
    const pkColumns = new Set(primaryKeys.map((row) => row.column_name));

    const foreignKeys = await this.all<{
      column_name: string;
      foreign_table: string;
      foreign_column: string;
    }>(
      `SELECT kcu.column_name,
              ccu.table_name AS foreign_table,
              ccu.column_name AS foreign_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_schema = kcu.constraint_schema
        AND tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_schema = tc.constraint_schema
        AND ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = ?
         AND tc.table_name = ?`,
      [schema, table]
    ).catch(() => [] as { column_name: string; foreign_table: string; foreign_column: string }[]);
    const fkMap = new Map(
      foreignKeys.map((row) => [
        row.column_name,
        { table: row.foreign_table, column: row.foreign_column },
      ])
    );

    return columns.map((row) => {
      let dataType = row.data_type || "unknown";
      if (row.character_maximum_length != null && Number(row.character_maximum_length) > 0) {
        dataType += `(${row.character_maximum_length})`;
      }
      return {
        name: row.column_name,
        dataType,
        nullable: String(row.is_nullable).toUpperCase() === "YES",
        defaultValue: row.column_default,
        isPrimaryKey: pkColumns.has(row.column_name),
        isForeignKey: fkMap.has(row.column_name),
        references: fkMap.get(row.column_name),
      };
    });
  }

  async getTableData(
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult> {
    const dir = pagination.orderDir === "DESC" ? "DESC" : "ASC";
    const orderBy = pagination.orderBy
      ? ` ORDER BY ${quoteIdent(pagination.orderBy)} ${dir}`
      : "";
    const sql = `SELECT * FROM ${qualifiedName(schema, table)}${orderBy} LIMIT ${Number(
      pagination.limit
    )} OFFSET ${Number(pagination.offset)}`;
    return this.executeQuery(sql);
  }

  async getTableRowCount(schema: string, table: string): Promise<number> {
    const rows = await this.all<{ count: number | bigint }>(
      `SELECT COUNT(*) AS count FROM ${qualifiedName(schema, table)}`
    );
    return Number(rows[0]?.count ?? 0);
  }

  async getPrimaryKeys(schema: string, table: string): Promise<string[]> {
    const rows = await this.all<{ column_name: string }>(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_schema = kcu.constraint_schema
        AND tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = ?
         AND tc.table_name = ?
       ORDER BY kcu.ordinal_position`,
      [schema, table]
    ).catch(() => [] as { column_name: string }[]);
    return rows.map((row) => row.column_name);
  }

  async updateCell(update: CellUpdate): Promise<QueryResult> {
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
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        error: "No primary key - cannot identify row to delete",
      };
    }

    const values = pkEntries.map(([, value]) => value);
    const whereParts = pkEntries.map(([column]) => `${quoteIdent(column)} = ?`);
    const sql = `DELETE FROM ${qualifiedName(params.schema, params.table)}
                 WHERE ${whereParts.join(" AND ")}`;
    return this.executeRun(sql, values);
  }

  async insertRow(params: RowInsert): Promise<QueryResult> {
    const entries = Object.entries(params.values).filter(
      ([, value]) => value !== undefined && value !== ""
    );
    if (entries.length === 0) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        error: "No values provided",
      };
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
      await this.run(sql, params);
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
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async truncateTable(schema: string, table: string): Promise<QueryResult> {
    return this.executeQuery(`DELETE FROM ${qualifiedName(schema, table)}`);
  }

  async dropTable(
    schema: string,
    table: string,
    type: "table" | "view"
  ): Promise<QueryResult> {
    const keyword = type === "view" ? "VIEW" : "TABLE";
    return this.executeQuery(`DROP ${keyword} ${qualifiedName(schema, table)}`);
  }

  async dropSchema(schema: string, cascade: boolean): Promise<QueryResult> {
    if (schema === "main" || schema === "temp") {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        error: `DuckDB cannot drop the ${schema} schema.`,
      };
    }
    return this.executeQuery(
      `DROP SCHEMA ${quoteIdent(schema)}${cascade ? " CASCADE" : ""}`
    );
  }

  async getIndexes(
    schema: string,
    table: string
  ): Promise<{ name: string; columns: string; isUnique: boolean; isPrimary: boolean }[]> {
    const rows = await this.all<{
      index_name: string;
      is_unique: boolean | number;
      is_primary: boolean | number;
      expressions: unknown;
      sql: string | null;
    }>(
      `SELECT index_name, is_unique, is_primary, expressions, sql
       FROM duckdb_indexes()
       WHERE schema_name = ? AND table_name = ?
       ORDER BY index_name`,
      [schema, table]
    ).catch(() => [] as {
      index_name: string;
      is_unique: boolean | number;
      is_primary: boolean | number;
      expressions: unknown;
      sql: string | null;
    }[]);

    return rows.map((row) => {
      let columns = "";
      if (Array.isArray(row.expressions)) {
        columns = row.expressions.map((expr) => String(expr)).join(", ");
      } else if (typeof row.expressions === "string") {
        columns = row.expressions;
      } else if (row.sql) {
        columns = row.sql;
      }
      return {
        name: row.index_name,
        columns,
        isUnique: Boolean(row.is_unique),
        isPrimary: Boolean(row.is_primary),
      };
    });
  }

  async getTableSize(
    schema: string,
    table: string
  ): Promise<{ totalSize: string; dataSize: string; indexSize: string }> {
    void schema;
    void table;
    return {
      totalSize: "—",
      dataSize: "—",
      indexSize: "—",
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    let db: DuckDatabase | null = null;
    let conn: DuckConnection | null = null;
    try {
      const path = this.databasePath;
      db = new duckdb.Database(path) as unknown as DuckDatabase;
      conn = db.connect();
      await new Promise<void>((resolve, reject) => {
        conn!.all("SELECT 1 AS ok", (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      await this.closeConnection(conn);
      await this.closeDatabase(db);
      return { success: true };
    } catch (e: unknown) {
      await this.closeConnection(conn);
      await this.closeDatabase(db);
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
