import { BigQuery, type TableMetadata } from "@google-cloud/bigquery";
import { existsSync } from "node:fs";
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
  return `\`${name.replace(/`/g, "\\`")}\``;
}

function quoteLiteral(value: unknown): string {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `TIMESTAMP('${value.toISOString()}')`;
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

function looksLikeKeyFilePath(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{")) return false;
  return (
    trimmed.endsWith(".json") ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    existsSync(trimmed)
  );
}

export class BigQueryAdapter extends DatabaseAdapter {
  private client: BigQuery | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  private projectId(): string {
    return this.config.projectId || this.config.database || this.config.host;
  }

  private resolveKeyFilename(): string | undefined {
    if (this.config.filePath && looksLikeKeyFilePath(this.config.filePath)) {
      return this.config.filePath;
    }
    if (looksLikeKeyFilePath(this.config.password)) {
      return this.config.password;
    }
    if (this.config.authMethod === "keyfile" && this.config.filePath) {
      return this.config.filePath;
    }
    return undefined;
  }

  private createBigQueryClient(): BigQuery {
    const options: ConstructorParameters<typeof BigQuery>[0] = {
      projectId: this.projectId() || undefined,
    };
    const keyFilename = this.resolveKeyFilename();
    if (keyFilename) {
      options.keyFilename = keyFilename;
    }
    return new BigQuery(options);
  }

  private qualifiedTable(schema: string, table: string): string {
    const project = this.projectId();
    if (project) {
      return `${quoteIdent(project)}.${quoteIdent(schema)}.${quoteIdent(table)}`;
    }
    return `${quoteIdent(schema)}.${quoteIdent(table)}`;
  }

  async connect(): Promise<void> {
    const client = this.createBigQueryClient();
    try {
      await client.getDatasets({ maxResults: 1 });
      this.client = client;
    } catch (err) {
      this.client = null;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.client) throw new Error("Not connected");
    const start = performance.now();

    try {
      const [rows, job] = await this.client.query({ query: sql });
      const typedRows = (rows ?? []) as QueryRow[];
      const fields =
        (
          job as {
            statistics?: {
              query?: { schema?: { fields?: Array<{ name?: string | null; type?: string | null }> } };
            };
          }
        ).statistics?.query?.schema?.fields ?? [];
      const columns =
        fields.length > 0
          ? fields.map((field) => field.name || "")
          : typedRows.length > 0
            ? Object.keys(typedRows[0])
            : [];

      return {
        columns,
        columnTypes: fields.map((field) => ({
          name: field.name || "",
          dataType: field.type || "unknown",
        })),
        rows: typedRows,
        rowCount: typedRows.length,
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
    if (!this.client) throw new Error("Not connected");
    const [datasets] = await this.client.getDatasets();
    return datasets
      .map((dataset) => dataset.id || "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    if (!this.client) throw new Error("Not connected");
    const datasetId = schema || this.config.database;
    if (!datasetId) return [];

    const dataset = this.client.dataset(datasetId);
    const [tables] = await dataset.getTables();

    const results: TableInfo[] = [];
    for (const table of tables) {
      const name = table.id || "";
      if (!name) continue;
      let type: "table" | "view" = "table";
      try {
        const [metadata] = await table.getMetadata();
        if (metadata.type === "VIEW" || metadata.type === "MATERIALIZED_VIEW") {
          type = "view";
        }
      } catch {
        type = "table";
      }
      results.push({ schema: datasetId, name, type });
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    if (!this.client) throw new Error("Not connected");
    const bqTable = this.client.dataset(schema).table(table);
    const [metadata] = await bqTable.getMetadata();
    const fields = (metadata.schema?.fields ?? []) as Array<{
      name?: string;
      type?: string;
      mode?: string;
    }>;
    const primaryKeys = await this.getPrimaryKeys(schema, table);
    const pkSet = new Set(primaryKeys);

    return fields.map((field) => ({
      name: field.name || "",
      dataType: field.type || "UNKNOWN",
      nullable: field.mode !== "REQUIRED",
      defaultValue: null,
      isPrimaryKey: pkSet.has(field.name || ""),
      isForeignKey: false,
    }));
  }

  async getTableData(
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult> {
    const tableName = this.qualifiedTable(schema, table);
    const dir = pagination.orderDir === "DESC" ? "DESC" : "ASC";
    const orderBy = pagination.orderBy ? ` ORDER BY ${quoteIdent(pagination.orderBy)} ${dir}` : "";
    const sql = `SELECT * FROM ${tableName}${orderBy} LIMIT ${Number(
      pagination.limit
    )} OFFSET ${Number(pagination.offset)}`;
    return this.executeQuery(sql);
  }

  async getTableRowCount(schema: string, table: string): Promise<number> {
    if (!this.client) throw new Error("Not connected");
    try {
      const [metadata] = await this.client.dataset(schema).table(table).getMetadata();
      if (metadata.numRows != null) {
        return Number(metadata.numRows);
      }
    } catch {
      // Fall through to COUNT(*).
    }

    const tableName = this.qualifiedTable(schema, table);
    const result = await this.executeQuery(`SELECT COUNT(*) AS count FROM ${tableName}`);
    if (result.error) throw new Error(result.error);
    return Number(result.rows[0]?.count ?? 0);
  }

  async getPrimaryKeys(schema: string, table: string): Promise<string[]> {
    if (!this.client) throw new Error("Not connected");
    try {
      const [metadata] = await this.client.dataset(schema).table(table).getMetadata();
      const tableConstraints = (metadata as TableMetadata & {
        tableConstraints?: { primaryKey?: { columns?: string[] } };
      }).tableConstraints;
      return tableConstraints?.primaryKey?.columns ?? [];
    } catch {
      return [];
    }
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
    const sql = `UPDATE ${this.qualifiedTable(update.schema, update.table)}
                 SET ${quoteIdent(update.column)} = ${quoteLiteral(update.value === "" ? null : update.value)}
                 WHERE ${whereParts.join(" AND ")}`;
    return this.executeQuery(sql);
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
    const sql = `DELETE FROM ${this.qualifiedTable(params.schema, params.table)}
                 WHERE ${whereParts.join(" AND ")}`;
    return this.executeQuery(sql);
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
    const sql = `INSERT INTO ${this.qualifiedTable(params.schema, params.table)} (${columns})
                 VALUES (${values})`;
    return this.executeQuery(sql);
  }

  async truncateTable(schema: string, table: string): Promise<QueryResult> {
    const tableName = this.qualifiedTable(schema, table);
    const truncateResult = await this.executeQuery(`TRUNCATE TABLE ${tableName}`);
    if (!truncateResult.error) return truncateResult;
    return this.executeQuery(`DELETE FROM ${tableName} WHERE TRUE`);
  }

  async dropTable(schema: string, table: string, type: "table" | "view"): Promise<QueryResult> {
    const keyword = type === "view" ? "VIEW" : "TABLE";
    return this.executeQuery(`DROP ${keyword} ${this.qualifiedTable(schema, table)}`);
  }

  async dropSchema(schema: string, cascade: boolean): Promise<QueryResult> {
    const cascadeSql = cascade ? " CASCADE" : "";
    const project = this.projectId();
    const datasetRef = project
      ? `${quoteIdent(project)}.${quoteIdent(schema)}`
      : quoteIdent(schema);
    return this.executeQuery(`DROP SCHEMA ${datasetRef}${cascadeSql}`);
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
    if (!this.client) throw new Error("Not connected");
    try {
      const [metadata] = await this.client.dataset(schema).table(table).getMetadata();
      const bytes = Number(metadata.numBytes ?? 0);
      const formatted = formatBytes(bytes);
      return { totalSize: formatted, dataSize: formatted, indexSize: "—" };
    } catch {
      return { totalSize: "—", dataSize: "—", indexSize: "—" };
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const client = this.createBigQueryClient();
    try {
      await client.getDatasets({ maxResults: 1 });
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: errorMessage(e) };
    }
  }
}
