import ibmdb from "ibm_db";
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

/** ibm_db connection handle — typings are incomplete across versions. */
type Db2Connection = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function qualifiedName(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} kB`;
  return `${value} B`;
}

function formatDb2Type(row: {
  TYPENAME: string;
  LENGTH: number;
  SCALE: number;
}): string {
  const type = String(row.TYPENAME || "UNKNOWN").toUpperCase();
  if (["VARCHAR", "CHAR", "CHARACTER", "GRAPHIC", "VARGRAPHIC", "CLOB", "BLOB", "DBCLOB"].includes(type)) {
    return `${type}(${row.LENGTH})`;
  }
  if (["DECIMAL", "NUMERIC", "DECFLOAT"].includes(type) && row.SCALE != null) {
    return `${type}(${row.LENGTH},${row.SCALE})`;
  }
  return type;
}

function parseIndexColumns(colnames: string | null | undefined): string {
  if (!colnames) return "";
  // SYSCAT.INDEXES.COLNAMES looks like "+COL1+COL2" or "-COL1+COL2"
  return colnames
    .split("+")
    .map((part) => part.replace(/^[-+]?/, "").trim())
    .filter(Boolean)
    .map((name) => quoteIdent(name))
    .join(", ");
}

function affectedRowCount(result: unknown): number {
  if (result == null) return 0;
  if (typeof result === "number") return result;
  if (Array.isArray(result)) return result.length;
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (typeof obj.count === "number") return obj.count;
    if (typeof obj.affectedRows === "number") return obj.affectedRows;
  }
  return 0;
}

function isResultSet(result: unknown): result is QueryRow[] {
  return Array.isArray(result);
}

export class Db2Adapter extends DatabaseAdapter {
  private connection: Db2Connection | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  private buildConnectionString(): string {
    if (this.config.connectionString?.trim()) {
      return this.config.connectionString.trim();
    }

    const parts = [
      `DATABASE=${this.config.database}`,
      `HOSTNAME=${this.config.host}`,
      `PORT=${this.config.port}`,
      "PROTOCOL=TCPIP",
      `UID=${this.config.user}`,
      `PWD=${this.config.password}`,
    ];
    if (this.config.ssl) {
      parts.push("Security=SSL");
    }
    return `${parts.join(";")};`;
  }

  private openConnection(): Promise<Db2Connection> {
    const connStr = this.buildConnectionString();
    return new Promise((resolve, reject) => {
      ibmdb.open(connStr, (err: Error | null, conn: Db2Connection) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });
  }

  private closeConnection(conn: Db2Connection | null): Promise<void> {
    if (!conn) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        if (typeof conn.close === "function") {
          conn.close(() => resolve());
        } else if (typeof conn.closeSync === "function") {
          conn.closeSync();
          resolve();
        } else {
          resolve();
        }
      } catch {
        resolve();
      }
    });
  }

  private query<T extends QueryRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    if (!this.connection) throw new Error("Not connected");
    return new Promise((resolve, reject) => {
      this.connection.query(sql, params, (err: Error | null, result: unknown) => {
        if (err) {
          reject(err);
          return;
        }
        if (isResultSet(result)) {
          resolve(result as T[]);
        } else {
          resolve([]);
        }
      });
    });
  }

  private execute(
    sql: string,
    params: unknown[] = []
  ): Promise<{ rows: QueryRow[]; rowCount: number }> {
    if (!this.connection) throw new Error("Not connected");
    return new Promise((resolve, reject) => {
      this.connection.query(sql, params, (err: Error | null, result: unknown) => {
        if (err) {
          reject(err);
          return;
        }
        if (isResultSet(result)) {
          resolve({ rows: result as QueryRow[], rowCount: result.length });
        } else {
          resolve({ rows: [], rowCount: affectedRowCount(result) });
        }
      });
    });
  }

  async connect(): Promise<void> {
    const conn = await this.openConnection();
    try {
      await new Promise<void>((resolve, reject) => {
        conn.query("SELECT 1 FROM SYSIBM.SYSDUMMY1", (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (err) {
      await this.closeConnection(conn);
      throw err;
    }
    this.connection = conn;
  }

  async disconnect(): Promise<void> {
    const conn = this.connection;
    this.connection = null;
    await this.closeConnection(conn);
  }

  isConnected(): boolean {
    return this.connection !== null;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.connection) throw new Error("Not connected");
    const start = performance.now();

    try {
      const { rows, rowCount } = await this.execute(sql);
      const durationMs = Math.round(performance.now() - start);

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        return {
          columns,
          columnTypes: columns.map((column) => ({
            name: column,
            dataType: rows[0][column] == null ? "unknown" : typeof rows[0][column],
          })),
          rows,
          rowCount: rows.length,
          durationMs,
        };
      }

      return {
        columns: [],
        rows: [],
        rowCount,
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
    const rows = await this.query<{ SCHEMANAME: string }>(
      `SELECT SCHEMANAME
       FROM SYSCAT.SCHEMATA
       WHERE SCHEMANAME NOT LIKE 'SYS%'
         AND SCHEMANAME NOT IN ('NULLID', 'SQLJ', 'ERRORSCHEMA')
       ORDER BY SCHEMANAME`
    );
    return rows.map((row) => row.SCHEMANAME);
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const targetSchema = schema ?? this.config.user?.toUpperCase() ?? this.config.database;
    const rows = await this.query<{
      TABSCHEMA: string;
      TABNAME: string;
      TYPE: string;
    }>(
      `SELECT TABSCHEMA, TABNAME, TYPE
       FROM SYSCAT.TABLES
       WHERE TABSCHEMA = ?
         AND TYPE IN ('T', 'V')
       ORDER BY TABNAME`,
      [targetSchema]
    );

    return rows.map((row) => ({
      schema: row.TABSCHEMA,
      name: row.TABNAME,
      type: row.TYPE === "V" ? "view" : "table",
    }));
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const columns = await this.query<{
      COLNAME: string;
      TYPENAME: string;
      LENGTH: number;
      SCALE: number;
      NULLS: string;
      DEFAULT: string | null;
      KEYSEQ: number | null;
    }>(
      `SELECT COLNAME, TYPENAME, LENGTH, SCALE, NULLS, DEFAULT, KEYSEQ
       FROM SYSCAT.COLUMNS
       WHERE TABSCHEMA = ? AND TABNAME = ?
       ORDER BY COLNO`,
      [schema, table]
    );

    const primaryKeys = await this.getPrimaryKeys(schema, table);
    const pkColumns = new Set(primaryKeys);

    const foreignKeys = await this.query<{
      COLNAME: string;
      REFTABNAME: string;
      REFCOLNAME: string;
    }>(
      `SELECT kcu.COLNAME AS COLNAME,
              r.REFTABNAME AS REFTABNAME,
              pkcu.COLNAME AS REFCOLNAME
       FROM SYSCAT.REFERENCES r
       JOIN SYSCAT.KEYCOLUSE kcu
         ON r.TABSCHEMA = kcu.TABSCHEMA
        AND r.TABNAME = kcu.TABNAME
        AND r.CONSTNAME = kcu.CONSTNAME
       JOIN SYSCAT.KEYCOLUSE pkcu
         ON r.REFTABSCHEMA = pkcu.TABSCHEMA
        AND r.REFTABNAME = pkcu.TABNAME
        AND r.REFKEYNAME = pkcu.CONSTNAME
        AND kcu.COLSEQ = pkcu.COLSEQ
       WHERE r.TABSCHEMA = ?
         AND r.TABNAME = ?
       ORDER BY kcu.COLSEQ`,
      [schema, table]
    ).catch(() => [] as { COLNAME: string; REFTABNAME: string; REFCOLNAME: string }[]);

    const fkMap = new Map(
      foreignKeys.map((row) => [
        row.COLNAME,
        { table: row.REFTABNAME, column: row.REFCOLNAME },
      ])
    );

    return columns.map((row) => ({
      name: row.COLNAME,
      dataType: formatDb2Type(row),
      nullable: row.NULLS === "Y",
      defaultValue: row.DEFAULT,
      isPrimaryKey: pkColumns.has(row.COLNAME) || Number(row.KEYSEQ ?? 0) > 0,
      isForeignKey: fkMap.has(row.COLNAME),
      references: fkMap.get(row.COLNAME),
    }));
  }

  async getTableData(
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult> {
    const dir = pagination.orderDir === "DESC" ? "DESC" : "ASC";
    const innerOrder = pagination.orderBy
      ? ` ORDER BY ${quoteIdent(pagination.orderBy)} ${dir}`
      : "";
    const offset = Number(pagination.offset);
    const limit = Number(pagination.limit);
    const sql = `SELECT * FROM (
                   SELECT * FROM ${qualifiedName(schema, table)}${innerOrder}
                 ) AS t
                 OFFSET ${offset} ROWS FETCH FIRST ${limit} ROWS ONLY`;
    return this.executeQuery(sql);
  }

  async getTableRowCount(schema: string, table: string): Promise<number> {
    const rows = await this.query<{ COUNT: number | string }>(
      `SELECT COUNT(*) AS COUNT FROM ${qualifiedName(schema, table)}`
    );
    return Number(rows[0]?.COUNT ?? 0);
  }

  async getPrimaryKeys(schema: string, table: string): Promise<string[]> {
    const rows = await this.query<{ COLNAME: string }>(
      `SELECT kcu.COLNAME
       FROM SYSCAT.TABCONST tc
       JOIN SYSCAT.KEYCOLUSE kcu
         ON tc.TABSCHEMA = kcu.TABSCHEMA
        AND tc.TABNAME = kcu.TABNAME
        AND tc.CONSTNAME = kcu.CONSTNAME
       WHERE tc.TABSCHEMA = ?
         AND tc.TABNAME = ?
         AND tc.TYPE = 'P'
       ORDER BY kcu.COLSEQ`,
      [schema, table]
    );
    return rows.map((row) => row.COLNAME);
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
    return this.executeDml(sql, values);
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
    return this.executeDml(sql, values);
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
    return this.executeDml(sql, values);
  }

  private async executeDml(sql: string, params: unknown[]): Promise<QueryResult> {
    const start = performance.now();
    try {
      const { rowCount } = await this.execute(sql, params);
      return {
        columns: [],
        rows: [],
        rowCount,
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
    return this.executeQuery(
      `TRUNCATE TABLE ${qualifiedName(schema, table)} IMMEDIATE`
    );
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
    // Db2 uses RESTRICT (default) or CASCADE
    const mode = cascade ? "CASCADE" : "RESTRICT";
    return this.executeQuery(`DROP SCHEMA ${quoteIdent(schema)} ${mode}`);
  }

  async getIndexes(
    schema: string,
    table: string
  ): Promise<{ name: string; columns: string; isUnique: boolean; isPrimary: boolean }[]> {
    const rows = await this.query<{
      INDNAME: string;
      COLNAMES: string;
      UNIQUERULE: string;
    }>(
      `SELECT INDNAME, COLNAMES, UNIQUERULE
       FROM SYSCAT.INDEXES
       WHERE TABSCHEMA = ? AND TABNAME = ?
       ORDER BY INDNAME`,
      [schema, table]
    );

    return rows.map((row) => ({
      name: row.INDNAME,
      columns: parseIndexColumns(row.COLNAMES),
      isUnique: row.UNIQUERULE === "U" || row.UNIQUERULE === "P",
      isPrimary: row.UNIQUERULE === "P",
    }));
  }

  async getTableSize(
    schema: string,
    table: string
  ): Promise<{ totalSize: string; dataSize: string; indexSize: string }> {
    try {
      const tableRows = await this.query<{
        DATA_BYTES: number | null;
      }>(
        `SELECT COALESCE(t.NPAGES, 0) * COALESCE(ts.PAGESIZE, 0) AS DATA_BYTES
         FROM SYSCAT.TABLES t
         LEFT JOIN SYSCAT.TABLESPACES ts
           ON t.TBSPACE = ts.TBSPACE
         WHERE t.TABSCHEMA = ? AND t.TABNAME = ?`,
        [schema, table]
      );

      const indexRows = await this.query<{
        INDEX_BYTES: number | null;
      }>(
        `SELECT COALESCE(SUM(COALESCE(i.NLEAF, 0) * COALESCE(ts.PAGESIZE, 0)), 0) AS INDEX_BYTES
         FROM SYSCAT.INDEXES i
         LEFT JOIN SYSCAT.TABLESPACES ts
           ON i.TBSPACE = ts.TBSPACE
         WHERE i.TABSCHEMA = ? AND i.TABNAME = ?`,
        [schema, table]
      );

      const dataBytes = Number(tableRows[0]?.DATA_BYTES ?? 0);
      const indexBytes = Number(indexRows[0]?.INDEX_BYTES ?? 0);
      if (dataBytes <= 0 && indexBytes <= 0) {
        return { totalSize: "—", dataSize: "—", indexSize: "—" };
      }
      return {
        totalSize: formatBytes(dataBytes + indexBytes),
        dataSize: formatBytes(dataBytes),
        indexSize: formatBytes(indexBytes),
      };
    } catch {
      return { totalSize: "—", dataSize: "—", indexSize: "—" };
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    let conn: Db2Connection | null = null;
    try {
      conn = await this.openConnection();
      await new Promise<void>((resolve, reject) => {
        conn.query("SELECT 1 FROM SYSIBM.SYSDUMMY1", (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      await this.closeConnection(conn);
      return { success: true };
    } catch (e: unknown) {
      await this.closeConnection(conn);
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
