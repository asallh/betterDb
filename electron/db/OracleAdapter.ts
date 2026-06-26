import oracledb from "oracledb";
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
type BindValue = string | number | bigint | boolean | Date | Buffer | null | undefined;
type BindParams = Record<string, BindValue>;

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} kB`;
  return `${value} B`;
}

function bindValue(value: unknown): BindValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean" ||
    value instanceof Date ||
    Buffer.isBuffer(value)
  ) {
    return value;
  }

  return JSON.stringify(value);
}

export class OracleAdapter extends DatabaseAdapter {
  private connection: oracledb.Connection | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  }

  private connectString(): string {
    const endpoint = `${this.config.host}:${this.config.port}`;
    return this.config.database ? `${endpoint}/${this.config.database}` : endpoint;
  }

  private async query<T extends QueryRow>(
    sql: string,
    binds: BindParams = {}
  ): Promise<T[]> {
    if (!this.connection) throw new Error("Not connected");
    const result = await this.connection.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return (result.rows ?? []) as T[];
  }

  async connect(): Promise<void> {
    this.connection = await oracledb.getConnection({
      user: this.config.user,
      password: this.config.password,
      connectString: this.connectString(),
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
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
      const result = await this.connection.execute<QueryRow>(sql, {}, {
        autoCommit: true,
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      const rows = (result.rows ?? []) as QueryRow[];
      const metadata = result.metaData ?? [];

      return {
        columns: metadata.map((field) => field.name),
        columnTypes: metadata.map((field) => ({
          name: field.name,
          dataType: field.dbTypeName ?? "unknown",
        })),
        rows,
        rowCount: rows.length || result.rowsAffected || 0,
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
    const rows = await this.query<{ USERNAME: string }>(
      `SELECT USERNAME
       FROM ALL_USERS
       WHERE ORACLE_MAINTAINED = 'N'
       ORDER BY USERNAME`
    );
    return rows.map((row) => row.USERNAME);
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const owner = schema || this.config.user;
    const rows = await this.query<{
      OWNER: string;
      OBJECT_NAME: string;
      OBJECT_TYPE: string;
    }>(
      `SELECT OWNER, OBJECT_NAME, OBJECT_TYPE
       FROM ALL_OBJECTS
       WHERE OWNER = UPPER(:owner)
         AND OBJECT_TYPE IN ('TABLE', 'VIEW')
         AND OBJECT_NAME NOT LIKE 'BIN$%'
       ORDER BY OBJECT_NAME`,
      { owner }
    );

    return rows.map((row) => ({
      schema: row.OWNER,
      name: row.OBJECT_NAME,
      type: row.OBJECT_TYPE === "VIEW" ? "view" : "table",
    }));
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const columns = await this.query<{
      COLUMN_NAME: string;
      DATA_TYPE: string;
      DATA_LENGTH: number | null;
      DATA_PRECISION: number | null;
      DATA_SCALE: number | null;
      NULLABLE: string;
      DATA_DEFAULT: string | null;
    }>(
      `SELECT COLUMN_NAME,
              DATA_TYPE,
              DATA_LENGTH,
              DATA_PRECISION,
              DATA_SCALE,
              NULLABLE,
              DATA_DEFAULT
       FROM ALL_TAB_COLUMNS
       WHERE OWNER = UPPER(:owner)
         AND TABLE_NAME = UPPER(:tableName)
       ORDER BY COLUMN_ID`,
      { owner: schema, tableName: table }
    );

    const primaryKeys = await this.query<{ COLUMN_NAME: string }>(
      `SELECT cols.COLUMN_NAME
       FROM ALL_CONSTRAINTS cons
       JOIN ALL_CONS_COLUMNS cols
         ON cons.OWNER = cols.OWNER
        AND cons.CONSTRAINT_NAME = cols.CONSTRAINT_NAME
       WHERE cons.CONSTRAINT_TYPE = 'P'
         AND cons.OWNER = UPPER(:owner)
         AND cons.TABLE_NAME = UPPER(:tableName)
       ORDER BY cols.POSITION`,
      { owner: schema, tableName: table }
    );
    const pkColumns = new Set(primaryKeys.map((row) => row.COLUMN_NAME));

    const foreignKeys = await this.query<{
      COLUMN_NAME: string;
      FOREIGN_TABLE: string;
      FOREIGN_COLUMN: string;
    }>(
      `SELECT child_cols.COLUMN_NAME,
              parent_cols.TABLE_NAME AS FOREIGN_TABLE,
              parent_cols.COLUMN_NAME AS FOREIGN_COLUMN
       FROM ALL_CONSTRAINTS child_cons
       JOIN ALL_CONS_COLUMNS child_cols
         ON child_cons.OWNER = child_cols.OWNER
        AND child_cons.CONSTRAINT_NAME = child_cols.CONSTRAINT_NAME
       JOIN ALL_CONS_COLUMNS parent_cols
         ON child_cons.R_OWNER = parent_cols.OWNER
        AND child_cons.R_CONSTRAINT_NAME = parent_cols.CONSTRAINT_NAME
        AND child_cols.POSITION = parent_cols.POSITION
       WHERE child_cons.CONSTRAINT_TYPE = 'R'
         AND child_cons.OWNER = UPPER(:owner)
         AND child_cons.TABLE_NAME = UPPER(:tableName)`,
      { owner: schema, tableName: table }
    );
    const fkMap = new Map(
      foreignKeys.map((row) => [
        row.COLUMN_NAME,
        { table: row.FOREIGN_TABLE, column: row.FOREIGN_COLUMN },
      ])
    );

    return columns.map((row) => ({
      name: row.COLUMN_NAME,
      dataType: this.formatDataType(row),
      nullable: row.NULLABLE === "Y",
      defaultValue: row.DATA_DEFAULT?.trim() ?? null,
      isPrimaryKey: pkColumns.has(row.COLUMN_NAME),
      isForeignKey: fkMap.has(row.COLUMN_NAME),
      references: fkMap.get(row.COLUMN_NAME),
    }));
  }

  private formatDataType(row: {
    DATA_TYPE: string;
    DATA_LENGTH: number | null;
    DATA_PRECISION: number | null;
    DATA_SCALE: number | null;
  }): string {
    if (row.DATA_TYPE === "NUMBER" && row.DATA_PRECISION !== null) {
      return row.DATA_SCALE !== null && row.DATA_SCALE > 0
        ? `NUMBER(${row.DATA_PRECISION},${row.DATA_SCALE})`
        : `NUMBER(${row.DATA_PRECISION})`;
    }
    if (["VARCHAR2", "NVARCHAR2", "CHAR", "NCHAR"].includes(row.DATA_TYPE)) {
      return `${row.DATA_TYPE}(${row.DATA_LENGTH ?? 0})`;
    }
    return row.DATA_TYPE;
  }

  async getTableData(
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult> {
    const tableName = `${quoteIdent(schema)}.${quoteIdent(table)}`;
    const dir = pagination.orderDir === "DESC" ? "DESC" : "ASC";
    const orderBy = pagination.orderBy
      ? ` ORDER BY ${quoteIdent(pagination.orderBy)} ${dir}`
      : "";
    const sql = `SELECT * FROM ${tableName}${orderBy} OFFSET ${Number(
      pagination.offset
    )} ROWS FETCH NEXT ${Number(pagination.limit)} ROWS ONLY`;
    return this.executeQuery(sql);
  }

  async getTableRowCount(schema: string, table: string): Promise<number> {
    const rows = await this.query<{ COUNT_VALUE: number }>(
      `SELECT COUNT(*) AS COUNT_VALUE FROM ${quoteIdent(schema)}.${quoteIdent(table)}`
    );
    return Number(rows[0]?.COUNT_VALUE ?? 0);
  }

  async getPrimaryKeys(schema: string, table: string): Promise<string[]> {
    const rows = await this.query<{ COLUMN_NAME: string }>(
      `SELECT cols.COLUMN_NAME
       FROM ALL_CONSTRAINTS cons
       JOIN ALL_CONS_COLUMNS cols
         ON cons.OWNER = cols.OWNER
        AND cons.CONSTRAINT_NAME = cols.CONSTRAINT_NAME
       WHERE cons.CONSTRAINT_TYPE = 'P'
         AND cons.OWNER = UPPER(:owner)
         AND cons.TABLE_NAME = UPPER(:tableName)
       ORDER BY cols.POSITION`,
      { owner: schema, tableName: table }
    );
    return rows.map((row) => row.COLUMN_NAME);
  }

  async updateCell(update: CellUpdate): Promise<QueryResult> {
    const pkEntries = Object.entries(update.primaryKeys);
    if (pkEntries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No primary key - cannot identify row to update" };
    }

    const binds: BindParams = { value: update.value === "" ? null : bindValue(update.value) };
    const whereParts = pkEntries.map(([column], index) => {
      const key = `p${index + 1}`;
      binds[key] = bindValue(pkEntries[index][1]);
      return `${quoteIdent(column)} = :${key}`;
    });
    const sql = `UPDATE ${quoteIdent(update.schema)}.${quoteIdent(update.table)}
                 SET ${quoteIdent(update.column)} = :value
                 WHERE ${whereParts.join(" AND ")}`;
    return this.executeMutation(sql, binds);
  }

  async deleteRow(params: RowDelete): Promise<QueryResult> {
    const pkEntries = Object.entries(params.primaryKeys);
    if (pkEntries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No primary key - cannot identify row to delete" };
    }

    const binds: BindParams = {};
    const whereParts = pkEntries.map(([column, value], index) => {
      const key = `p${index + 1}`;
      binds[key] = bindValue(value);
      return `${quoteIdent(column)} = :${key}`;
    });
    const sql = `DELETE FROM ${quoteIdent(params.schema)}.${quoteIdent(params.table)}
                 WHERE ${whereParts.join(" AND ")}`;
    return this.executeMutation(sql, binds);
  }

  async insertRow(params: RowInsert): Promise<QueryResult> {
    const entries = Object.entries(params.values).filter(([, value]) => value !== undefined && value !== "");
    if (entries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No values provided" };
    }

    const binds: BindParams = {};
    const columns = entries.map(([column]) => quoteIdent(column)).join(", ");
    const placeholders = entries
      .map(([column], index) => {
        const key = `p${index + 1}`;
        binds[key] = params.values[column] === "" ? null : bindValue(params.values[column]);
        return `:${key}`;
      })
      .join(", ");
    const sql = `INSERT INTO ${quoteIdent(params.schema)}.${quoteIdent(params.table)} (${columns})
                 VALUES (${placeholders})`;
    return this.executeMutation(sql, binds);
  }

  private async executeMutation(sql: string, binds: BindParams): Promise<QueryResult> {
    if (!this.connection) throw new Error("Not connected");
    const start = performance.now();
    try {
      const result = await this.connection.execute(sql, binds, { autoCommit: true });
      return {
        columns: [],
        rows: [],
        rowCount: result.rowsAffected ?? 0,
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
    return this.executeQuery(`DROP USER ${quoteIdent(schema)}${cascade ? " CASCADE" : ""}`);
  }

  async getIndexes(
    schema: string,
    table: string
  ): Promise<{ name: string; columns: string; isUnique: boolean; isPrimary: boolean }[]> {
    const rows = await this.query<{
      INDEX_NAME: string;
      COLUMN_NAME: string;
      UNIQUENESS: string;
      IS_PRIMARY: string;
    }>(
      `SELECT idx.INDEX_NAME,
              cols.COLUMN_NAME,
              idx.UNIQUENESS,
              CASE WHEN cons.CONSTRAINT_TYPE = 'P' THEN 'Y' ELSE 'N' END AS IS_PRIMARY
       FROM ALL_INDEXES idx
       JOIN ALL_IND_COLUMNS cols
         ON idx.OWNER = cols.INDEX_OWNER
        AND idx.INDEX_NAME = cols.INDEX_NAME
       LEFT JOIN ALL_CONSTRAINTS cons
         ON cons.OWNER = idx.OWNER
        AND cons.INDEX_NAME = idx.INDEX_NAME
        AND cons.CONSTRAINT_TYPE = 'P'
       WHERE idx.TABLE_OWNER = UPPER(:owner)
         AND idx.TABLE_NAME = UPPER(:tableName)
       ORDER BY idx.INDEX_NAME, cols.COLUMN_POSITION`,
      { owner: schema, tableName: table }
    );

    const indexes = new Map<string, { columns: string[]; isUnique: boolean; isPrimary: boolean }>();
    for (const row of rows) {
      const existing =
        indexes.get(row.INDEX_NAME) ??
        {
          columns: [],
          isUnique: row.UNIQUENESS === "UNIQUE",
          isPrimary: row.IS_PRIMARY === "Y",
        };
      existing.columns.push(quoteIdent(row.COLUMN_NAME));
      indexes.set(row.INDEX_NAME, existing);
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
    const dataRows = await this.query<{ BYTES: number | null }>(
      `SELECT SUM(BYTES) AS BYTES
       FROM ALL_SEGMENTS
       WHERE OWNER = UPPER(:owner)
         AND SEGMENT_NAME = UPPER(:tableName)`,
      { owner: schema, tableName: table }
    );
    const indexRows = await this.query<{ BYTES: number | null }>(
      `SELECT SUM(seg.BYTES) AS BYTES
       FROM ALL_SEGMENTS seg
       JOIN ALL_INDEXES idx
         ON seg.OWNER = idx.OWNER
        AND seg.SEGMENT_NAME = idx.INDEX_NAME
       WHERE idx.TABLE_OWNER = UPPER(:owner)
         AND idx.TABLE_NAME = UPPER(:tableName)`,
      { owner: schema, tableName: table }
    );
    const dataSize = Number(dataRows[0]?.BYTES ?? 0);
    const indexSize = Number(indexRows[0]?.BYTES ?? 0);
    return {
      totalSize: formatBytes(dataSize + indexSize),
      dataSize: formatBytes(dataSize),
      indexSize: formatBytes(indexSize),
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await oracledb.getConnection({
        user: this.config.user,
        password: this.config.password,
        connectString: this.connectString(),
      });
      await connection.close();
      return { success: true };
    } catch (e: unknown) {
      await connection?.close().catch(() => {});
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
