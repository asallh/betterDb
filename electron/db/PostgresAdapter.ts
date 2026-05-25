import pg from "pg";
import { DatabaseAdapter } from "./DatabaseAdapter";
import type {
  ConnectionConfig,
  TableInfo,
  ColumnInfo,
  QueryResult,
  PaginationParams,
  CellUpdate,
  RowDelete,
  RowInsert,
} from "../../shared/types";

const { Pool } = pg;

export class PostgresAdapter extends DatabaseAdapter {
  private pool: pg.Pool | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: 3,
      idleTimeoutMillis: 30000,
    });
    // Verify connection works
    const client = await this.pool.connect();
    client.release();
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
      const res = await this.pool.query(sql);
      const durationMs = Math.round(performance.now() - start);
      // Handle commands that don't return rows (INSERT, UPDATE, DELETE, etc.)
      if (!res.fields || res.fields.length === 0) {
        return {
          columns: [],
          rows: [],
          rowCount: res.rowCount ?? 0,
          durationMs,
        };
      }
      return {
        columns: res.fields.map((f) => f.name),
        rows: res.rows,
        rowCount: res.rows.length,
        durationMs,
      };
    } catch (e: unknown) {
      const durationMs = Math.round(performance.now() - start);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async getSchemas(): Promise<string[]> {
    if (!this.pool) throw new Error("Not connected");
    const res = await this.pool.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY schema_name`
    );
    return res.rows.map((r) => r.schema_name);
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    if (!this.pool) throw new Error("Not connected");
    const targetSchema = schema ?? "public";
    const res = await this.pool.query(
      `SELECT table_schema, table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = $1
       ORDER BY table_name`,
      [targetSchema]
    );
    return res.rows.map((r) => ({
      schema: r.table_schema,
      name: r.table_name,
      type: r.table_type === "VIEW" ? "view" : "table",
    }));
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    if (!this.pool) throw new Error("Not connected");

    // Get columns with basic info
    const colRes = await this.pool.query(
      `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
              c.udt_name, c.character_maximum_length
       FROM information_schema.columns c
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      [schema, table]
    );

    // Get primary key columns
    const pkRes = await this.pool.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = $1 AND tc.table_name = $2`,
      [schema, table]
    );
    const pkColumns = new Set(pkRes.rows.map((r) => r.column_name));

    // Get foreign key columns
    const fkRes = await this.pool.query(
      `SELECT kcu.column_name,
              ccu.table_name AS foreign_table,
              ccu.column_name AS foreign_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = $1 AND tc.table_name = $2`,
      [schema, table]
    );
    const fkMap = new Map(
      fkRes.rows.map((r) => [
        r.column_name,
        { table: r.foreign_table, column: r.foreign_column },
      ])
    );

    return colRes.rows.map((r) => {
      let dataType = r.udt_name;
      if (r.character_maximum_length) {
        dataType += `(${r.character_maximum_length})`;
      }
      return {
        name: r.column_name,
        dataType,
        nullable: r.is_nullable === "YES",
        defaultValue: r.column_default,
        isPrimaryKey: pkColumns.has(r.column_name),
        isForeignKey: fkMap.has(r.column_name),
        references: fkMap.get(r.column_name),
      };
    });
  }

  async getTableData(
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult> {
    const quotedTable = `"${schema}"."${table}"`;
    let sql = `SELECT * FROM ${quotedTable}`;
    if (pagination.orderBy) {
      const dir = pagination.orderDir === "DESC" ? "DESC" : "ASC";
      sql += ` ORDER BY "${pagination.orderBy}" ${dir}`;
    }
    sql += ` LIMIT ${Number(pagination.limit)} OFFSET ${Number(pagination.offset)}`;
    return this.executeQuery(sql);
  }

  async getTableRowCount(schema: string, table: string): Promise<number> {
    if (!this.pool) throw new Error("Not connected");
    const quotedTable = `"${schema}"."${table}"`;
    const res = await this.pool.query(
      `SELECT count(*)::int AS count FROM ${quotedTable}`
    );
    return res.rows[0].count;
  }

  async getPrimaryKeys(schema: string, table: string): Promise<string[]> {
    if (!this.pool) throw new Error("Not connected");
    const res = await this.pool.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = $1 AND tc.table_name = $2
       ORDER BY kcu.ordinal_position`,
      [schema, table]
    );
    return res.rows.map((r) => r.column_name);
  }

  async updateCell(update: CellUpdate): Promise<QueryResult> {
    if (!this.pool) throw new Error("Not connected");
    const pkEntries = Object.entries(update.primaryKeys);
    if (pkEntries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No primary key — cannot identify row to update" };
    }

    const setCols = [`"${update.column}" = $1`];
    const params: unknown[] = [update.value === "" ? null : update.value];

    const whereParts = pkEntries.map(([ col ], i) => `"${col}" = $${i + 2}`);
    pkEntries.forEach(([, val]) => params.push(val));

    const sql = `UPDATE "${update.schema}"."${update.table}" SET ${setCols.join(", ")} WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();
    try {
      const res = await this.pool.query(sql, params);
      return { columns: [], rows: [], rowCount: res.rowCount ?? 0, durationMs: Math.round(performance.now() - start) };
    } catch (e: unknown) {
      return { columns: [], rows: [], rowCount: 0, durationMs: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
    }
  }

  async deleteRow(params: RowDelete): Promise<QueryResult> {
    if (!this.pool) throw new Error("Not connected");
    const pkEntries = Object.entries(params.primaryKeys);
    if (pkEntries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No primary key — cannot identify row to delete" };
    }

    const whereParts = pkEntries.map(([col], i) => `"${col}" = $${i + 1}`);
    const values = pkEntries.map(([, val]) => val);

    const sql = `DELETE FROM "${params.schema}"."${params.table}" WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();
    try {
      const res = await this.pool.query(sql, values);
      return { columns: [], rows: [], rowCount: res.rowCount ?? 0, durationMs: Math.round(performance.now() - start) };
    } catch (e: unknown) {
      return { columns: [], rows: [], rowCount: 0, durationMs: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
    }
  }

  async insertRow(params: RowInsert): Promise<QueryResult> {
    if (!this.pool) throw new Error("Not connected");
    const entries = Object.entries(params.values).filter(([, v]) => v !== undefined && v !== "");
    if (entries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No values provided" };
    }

    const cols = entries.map(([col]) => `"${col}"`).join(", ");
    const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
    const values = entries.map(([, val]) => val === "" ? null : val);

    const sql = `INSERT INTO "${params.schema}"."${params.table}" (${cols}) VALUES (${placeholders}) RETURNING *`;
    const start = performance.now();
    try {
      const res = await this.pool.query(sql, values);
      const durationMs = Math.round(performance.now() - start);
      return {
        columns: res.fields?.map((f) => f.name) ?? [],
        rows: res.rows ?? [],
        rowCount: res.rowCount ?? 0,
        durationMs,
      };
    } catch (e: unknown) {
      return { columns: [], rows: [], rowCount: 0, durationMs: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const testPool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: 1,
      connectionTimeoutMillis: 5000,
    });
    try {
      const client = await testPool.connect();
      client.release();
      await testPool.end();
      return { success: true };
    } catch (e: unknown) {
      try {
        await testPool.end();
      } catch {}
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
