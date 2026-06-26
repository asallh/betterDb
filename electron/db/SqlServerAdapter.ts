import mssql from "mssql";
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

function quoteIdent(name: string): string {
  return `[${name.replace(/]/g, "]]")}]`;
}

function formatDataType(row: {
  data_type: string;
  max_length: number;
  precision: number;
  scale: number;
}): string {
  const type = row.data_type.toLowerCase();

  if (["varchar", "char", "varbinary", "binary"].includes(type)) {
    return row.max_length === -1 ? `${type}(max)` : `${type}(${row.max_length})`;
  }

  if (["nvarchar", "nchar"].includes(type)) {
    return row.max_length === -1 ? `${type}(max)` : `${type}(${row.max_length / 2})`;
  }

  if (["decimal", "numeric"].includes(type)) {
    return `${type}(${row.precision},${row.scale})`;
  }

  if (["datetime2", "datetimeoffset", "time"].includes(type)) {
    return `${type}(${row.scale})`;
  }

  return type;
}

function formatSize(kb: number | null | undefined): string {
  const value = Number(kb ?? 0);
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} GB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} MB`;
  return `${value} kB`;
}

function getColumnTypeName(column: { type: unknown }): string {
  const type = column.type;
  if (typeof type === "function") {
    return type.name.toLowerCase();
  }

  if (type && typeof type === "object" && "name" in type) {
    return String((type as { name: unknown }).name).toLowerCase();
  }

  return "unknown";
}

export class SqlServerAdapter extends DatabaseAdapter {
  private pool: mssql.ConnectionPool | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  private buildConfig(): mssql.config {
    const trustServerCertificate =
      this.config.trustServerCertificate ?? this.config.sslRejectUnauthorized === false;

    return {
      server: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      pool: {
        max: 3,
        idleTimeoutMillis: 30000,
      },
      options: {
        encrypt: this.config.ssl ?? false,
        trustServerCertificate,
        ...(this.config.instanceName ? { instanceName: this.config.instanceName } : {}),
      },
    };
  }

  private request(params: unknown[] = []): mssql.Request {
    if (!this.pool) throw new Error("Not connected");
    const request = this.pool.request();
    params.forEach((value, index) => {
      request.input(`p${index + 1}`, value);
    });
    return request;
  }

  private async query<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<mssql.IResult<T>> {
    return this.request(params).query<T>(sql);
  }

  async connect(): Promise<void> {
    this.pool = new mssql.ConnectionPool(this.buildConfig());
    try {
      await this.pool.connect();
    } catch (err) {
      await this.pool.close().catch(() => {});
      this.pool = null;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  isConnected(): boolean {
    return this.pool !== null && this.pool.connected;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.pool) throw new Error("Not connected");
    const start = performance.now();

    try {
      const res = await this.pool.request().query(sql);
      const rows = (res.recordset ?? []) as Record<string, unknown>[];
      const columns = res.recordset?.columns
        ? Object.keys(res.recordset.columns)
        : [];
      const columnTypes = res.recordset?.columns
        ? Object.values(res.recordset.columns).map((column) => ({
            name: column.name,
            dataType: getColumnTypeName(column),
          }))
        : undefined;
      const rowCount = rows.length || res.rowsAffected.reduce((sum, count) => sum + count, 0);

      return {
        columns,
        columnTypes,
        rows,
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

  async getSchemas(): Promise<string[]> {
    const res = await this.query<{ name: string }>(
      `SELECT name
       FROM sys.schemas
       WHERE name NOT IN (
         'sys',
         'INFORMATION_SCHEMA',
         'guest',
         'db_owner',
         'db_accessadmin',
         'db_securityadmin',
         'db_ddladmin',
         'db_backupoperator',
         'db_datareader',
         'db_datawriter',
         'db_denydatareader',
         'db_denydatawriter'
       )
       ORDER BY name`
    );
    return res.recordset.map((r) => r.name);
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const targetSchema = schema ?? "dbo";
    const res = await this.query<{
      table_schema: string;
      table_name: string;
      table_type: string;
    }>(
      `SELECT TABLE_SCHEMA AS table_schema,
              TABLE_NAME AS table_name,
              TABLE_TYPE AS table_type
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = @p1
       ORDER BY TABLE_NAME`,
      [targetSchema]
    );

    return res.recordset.map((r) => ({
      schema: r.table_schema,
      name: r.table_name,
      type: r.table_type === "VIEW" ? "view" : "table",
    }));
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const colRes = await this.query<{
      column_name: string;
      data_type: string;
      max_length: number;
      precision: number;
      scale: number;
      is_nullable: boolean;
      default_value: string | null;
    }>(
      `SELECT c.name AS column_name,
              t.name AS data_type,
              c.max_length,
              c.precision,
              c.scale,
              c.is_nullable,
              dc.definition AS default_value
       FROM sys.columns c
       JOIN sys.types t ON c.user_type_id = t.user_type_id
       JOIN sys.objects o ON c.object_id = o.object_id
       JOIN sys.schemas s ON o.schema_id = s.schema_id
       LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
       WHERE s.name = @p1 AND o.name = @p2 AND o.type IN ('U', 'V')
       ORDER BY c.column_id`,
      [schema, table]
    );

    const pkRes = await this.query<{ column_name: string }>(
      `SELECT c.name AS column_name
       FROM sys.indexes i
       JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
       JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
       JOIN sys.objects o ON i.object_id = o.object_id
       JOIN sys.schemas s ON o.schema_id = s.schema_id
       WHERE i.is_primary_key = 1
         AND s.name = @p1
         AND o.name = @p2
       ORDER BY ic.key_ordinal`,
      [schema, table]
    );
    const pkColumns = new Set(pkRes.recordset.map((r) => r.column_name));

    const fkRes = await this.query<{
      column_name: string;
      foreign_table: string;
      foreign_column: string;
    }>(
      `SELECT pc.name AS column_name,
              rt.name AS foreign_table,
              rc.name AS foreign_column
       FROM sys.foreign_key_columns fkc
       JOIN sys.objects po ON fkc.parent_object_id = po.object_id
       JOIN sys.schemas ps ON po.schema_id = ps.schema_id
       JOIN sys.columns pc ON fkc.parent_object_id = pc.object_id
                          AND fkc.parent_column_id = pc.column_id
       JOIN sys.objects rt ON fkc.referenced_object_id = rt.object_id
       JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id
                          AND fkc.referenced_column_id = rc.column_id
       WHERE ps.name = @p1 AND po.name = @p2`,
      [schema, table]
    );
    const fkMap = new Map(
      fkRes.recordset.map((r) => [
        r.column_name,
        { table: r.foreign_table, column: r.foreign_column },
      ])
    );

    return colRes.recordset.map((r) => ({
      name: r.column_name,
      dataType: formatDataType(r),
      nullable: r.is_nullable,
      defaultValue: r.default_value,
      isPrimaryKey: pkColumns.has(r.column_name),
      isForeignKey: fkMap.has(r.column_name),
      references: fkMap.get(r.column_name),
    }));
  }

  async getTableData(
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult> {
    const quotedTable = `${quoteIdent(schema)}.${quoteIdent(table)}`;
    const dir = pagination.orderDir === "DESC" ? "DESC" : "ASC";
    const orderBy = pagination.orderBy
      ? `${quoteIdent(pagination.orderBy)} ${dir}`
      : "(SELECT NULL)";
    const sql = `SELECT * FROM ${quotedTable} ORDER BY ${orderBy} OFFSET ${Number(
      pagination.offset
    )} ROWS FETCH NEXT ${Number(pagination.limit)} ROWS ONLY`;
    return this.executeQuery(sql);
  }

  async getTableRowCount(schema: string, table: string): Promise<number> {
    const quotedTable = `${quoteIdent(schema)}.${quoteIdent(table)}`;
    const res = await this.query<{ count: number }>(
      `SELECT COUNT_BIG(*) AS count FROM ${quotedTable}`
    );
    return Number(res.recordset[0]?.count ?? 0);
  }

  async getPrimaryKeys(schema: string, table: string): Promise<string[]> {
    const res = await this.query<{ column_name: string }>(
      `SELECT c.name AS column_name
       FROM sys.indexes i
       JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
       JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
       JOIN sys.objects o ON i.object_id = o.object_id
       JOIN sys.schemas s ON o.schema_id = s.schema_id
       WHERE i.is_primary_key = 1
         AND s.name = @p1
         AND o.name = @p2
       ORDER BY ic.key_ordinal`,
      [schema, table]
    );
    return res.recordset.map((r) => r.column_name);
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
    const whereParts = pkEntries.map(([col], i) => `${quoteIdent(col)} = @p${i + 2}`);
    pkEntries.forEach(([, val]) => values.push(val));

    const sql = `UPDATE ${quoteIdent(update.schema)}.${quoteIdent(update.table)}
                 SET ${quoteIdent(update.column)} = @p1
                 WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();

    try {
      const res = await this.query(sql, values);
      return {
        columns: [],
        rows: [],
        rowCount: res.rowsAffected.reduce((sum, count) => sum + count, 0),
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

    const whereParts = pkEntries.map(([col], i) => `${quoteIdent(col)} = @p${i + 1}`);
    const values = pkEntries.map(([, val]) => val);
    const sql = `DELETE FROM ${quoteIdent(params.schema)}.${quoteIdent(params.table)}
                 WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();

    try {
      const res = await this.query(sql, values);
      return {
        columns: [],
        rows: [],
        rowCount: res.rowsAffected.reduce((sum, count) => sum + count, 0),
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

  async insertRow(params: RowInsert): Promise<QueryResult> {
    const entries = Object.entries(params.values).filter(([, v]) => v !== undefined && v !== "");
    if (entries.length === 0) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        error: "No values provided",
      };
    }

    const cols = entries.map(([col]) => quoteIdent(col)).join(", ");
    const placeholders = entries.map((_, i) => `@p${i + 1}`).join(", ");
    const values = entries.map(([, val]) => (val === "" ? null : val));
    const sql = `INSERT INTO ${quoteIdent(params.schema)}.${quoteIdent(params.table)} (${cols})
                 OUTPUT INSERTED.*
                 VALUES (${placeholders})`;
    const start = performance.now();

    try {
      const res = await this.query(sql, values);
      const rows = (res.recordset ?? []) as Record<string, unknown>[];
      return {
        columns: res.recordset?.columns ? Object.keys(res.recordset.columns) : [],
        rows,
        rowCount: res.rowsAffected.reduce((sum, count) => sum + count, 0),
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
    const start = performance.now();
    try {
      await this.query(`TRUNCATE TABLE ${quoteIdent(schema)}.${quoteIdent(table)}`);
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

  async dropTable(
    schema: string,
    table: string,
    type: "table" | "view"
  ): Promise<QueryResult> {
    const keyword = type === "view" ? "VIEW" : "TABLE";
    const start = performance.now();
    try {
      await this.query(`DROP ${keyword} ${quoteIdent(schema)}.${quoteIdent(table)}`);
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

  async dropSchema(schema: string, cascade: boolean): Promise<QueryResult> {
    if (cascade) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: 0,
        error: "SQL Server does not support DROP SCHEMA CASCADE.",
      };
    }

    const start = performance.now();
    try {
      await this.query(`DROP SCHEMA ${quoteIdent(schema)}`);
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

  async getIndexes(
    schema: string,
    table: string
  ): Promise<{ name: string; columns: string; isUnique: boolean; isPrimary: boolean }[]> {
    const res = await this.query<{
      index_name: string;
      column_name: string;
      is_included_column: boolean;
      is_unique: boolean;
      is_primary: boolean;
    }>(
      `SELECT i.name AS index_name,
              c.name AS column_name,
              ic.is_included_column,
              i.is_unique,
              i.is_primary_key AS is_primary
       FROM sys.indexes i
       JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
       JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
       JOIN sys.objects o ON i.object_id = o.object_id
       JOIN sys.schemas s ON o.schema_id = s.schema_id
       WHERE s.name = @p1
         AND o.name = @p2
         AND i.name IS NOT NULL
       ORDER BY i.name, ic.key_ordinal, ic.index_column_id`,
      [schema, table]
    );

    const indexes = new Map<
      string,
      { name: string; columns: string[]; included: string[]; isUnique: boolean; isPrimary: boolean }
    >();

    for (const row of res.recordset) {
      const existing =
        indexes.get(row.index_name) ??
        {
          name: row.index_name,
          columns: [],
          included: [],
          isUnique: row.is_unique,
          isPrimary: row.is_primary,
        };
      if (row.is_included_column) {
        existing.included.push(quoteIdent(row.column_name));
      } else {
        existing.columns.push(quoteIdent(row.column_name));
      }
      indexes.set(row.index_name, existing);
    }

    return Array.from(indexes.values()).map((index) => ({
      name: index.name,
      columns: `${index.columns.join(", ")}${
        index.included.length > 0 ? ` INCLUDE (${index.included.join(", ")})` : ""
      }`,
      isUnique: index.isUnique,
      isPrimary: index.isPrimary,
    }));
  }

  async getTableSize(
    schema: string,
    table: string
  ): Promise<{ totalSize: string; dataSize: string; indexSize: string }> {
    const res = await this.query<{
      total_kb: number;
      data_kb: number;
      index_kb: number;
    }>(
      `SELECT SUM(a.total_pages) * 8 AS total_kb,
              SUM(CASE WHEN i.index_id IN (0, 1) THEN a.used_pages ELSE 0 END) * 8 AS data_kb,
              SUM(CASE WHEN i.index_id > 1 THEN a.used_pages ELSE 0 END) * 8 AS index_kb
       FROM sys.tables t
       JOIN sys.schemas s ON t.schema_id = s.schema_id
       JOIN sys.indexes i ON t.object_id = i.object_id
       JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
       JOIN sys.allocation_units a ON p.partition_id = a.container_id
       WHERE s.name = @p1 AND t.name = @p2`,
      [schema, table]
    );
    const size = res.recordset[0];

    return {
      totalSize: formatSize(size?.total_kb),
      dataSize: formatSize(size?.data_kb),
      indexSize: formatSize(size?.index_kb),
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const testPool = new mssql.ConnectionPool({
      ...this.buildConfig(),
      connectionTimeout: 5000,
    });

    try {
      await testPool.connect();
      await testPool.close();
      return { success: true };
    } catch (e: unknown) {
      await testPool.close().catch(() => {});
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
