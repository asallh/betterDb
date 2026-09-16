export type EngineKind = "sql" | "document" | "keyvalue";

export type QueryLanguage = "sql" | "mongodb" | "redis";

export type DatabaseEngine =
  | "postgres"
  | "supabase"
  | "aws"
  | "databricks"
  | "cockroach"
  | "sqlserver"
  | "oracle"
  | "mysql"
  | "sqlite"
  | "mariadb"
  | "duckdb"
  | "db2"
  | "snowflake"
  | "clickhouse"
  | "bigquery"
  | "mongodb"
  | "redis";

export interface ConnectionConfig {
  id: string;
  name: string;
  engine: DatabaseEngine;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  sslRejectUnauthorized?: boolean;
  trustServerCertificate?: boolean;
  instanceName?: string;
  color?: string;
  /** Snowflake account identifier (e.g. xy12345.us-east-1). */
  account?: string;
  /** Snowflake warehouse name. */
  warehouse?: string;
  /** Snowflake / cloud role. */
  role?: string;
  /** BigQuery GCP project id. */
  projectId?: string;
  /** Auth hint: password | keyfile | adc */
  authMethod?: string;
  /** File path for SQLite/DuckDB/service-account JSON. */
  filePath?: string;
  /** Optional full connection / JDBC-style string. */
  connectionString?: string;
}

export interface TableInfo {
  schema: string;
  name: string;
  type: "table" | "view";
  rowCountEstimate?: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: { table: string; column: string };
}

export interface ColumnType {
  name: string;
  dataType: string;
}

export interface QueryResult {
  columns: string[];
  columnTypes?: ColumnType[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  error?: string;
}

export interface PaginationParams {
  offset: number;
  limit: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
}

export interface CellUpdate {
  schema: string;
  table: string;
  column: string;
  value: unknown;
  primaryKeys: Record<string, unknown>;
}

export interface RowDelete {
  schema: string;
  table: string;
  primaryKeys: Record<string, unknown>;
}

export interface RowInsert {
  schema: string;
  table: string;
  values: Record<string, unknown>;
}

export interface QueryHistoryEntry {
  id: string;
  sql: string;
  connectionId: string;
  executedAt: string;
  durationMs: number;
  rowCount: number;
  error?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  connectionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportRequest {
  format: "csv" | "json";
  columns: string[];
  rows: Record<string, unknown>[];
  suggestedName?: string;
}
