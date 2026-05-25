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

export abstract class DatabaseAdapter {
  protected config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;

  abstract executeQuery(sql: string): Promise<QueryResult>;

  abstract getSchemas(): Promise<string[]>;
  abstract getTables(schema?: string): Promise<TableInfo[]>;
  abstract getColumns(schema: string, table: string): Promise<ColumnInfo[]>;

  abstract getTableData(
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult>;
  abstract getTableRowCount(schema: string, table: string): Promise<number>;

  abstract testConnection(): Promise<{ success: boolean; error?: string }>;

  abstract updateCell(update: CellUpdate): Promise<QueryResult>;
  abstract deleteRow(params: RowDelete): Promise<QueryResult>;
  abstract insertRow(params: RowInsert): Promise<QueryResult>;
  abstract getPrimaryKeys(schema: string, table: string): Promise<string[]>;
}
