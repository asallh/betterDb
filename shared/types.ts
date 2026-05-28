export interface ConnectionConfig {
  id: string;
  name: string;
  engine: 'postgres' | 'supabase' | 'aws';
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  sslRejectUnauthorized?: boolean;
  color?: string;
}

export interface TableInfo {
  schema: string;
  name: string;
  type: 'table' | 'view';
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
  orderDir?: 'ASC' | 'DESC';
}

export interface CellUpdate {
  schema: string;
  table: string;
  column: string;
  value: unknown;
  primaryKeys: Record<string, unknown>; // PK column -> value to identify the row
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
