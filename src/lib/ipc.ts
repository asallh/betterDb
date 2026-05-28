import type {
  ConnectionConfig,
  TableInfo,
  ColumnInfo,
  QueryResult,
  PaginationParams,
  CellUpdate,
  RowDelete,
  RowInsert,
  QueryHistoryEntry,
  SavedQuery,
  ExportRequest,
} from "../../shared/types";

export const db = {
  // Connection management
  listConnections: (): Promise<ConnectionConfig[]> =>
    window.ipcRenderer.invoke("db:connections:list"),
  saveConnection: (config: ConnectionConfig): Promise<void> =>
    window.ipcRenderer.invoke("db:connections:save", config),
  deleteConnection: (id: string): Promise<void> =>
    window.ipcRenderer.invoke("db:connections:delete", id),
  getConnection: (id: string): Promise<ConnectionConfig> =>
    window.ipcRenderer.invoke("db:connections:get", id) as Promise<ConnectionConfig>,
  testConnection: (
    config: ConnectionConfig
  ): Promise<{ success: boolean; error?: string }> =>
    window.ipcRenderer.invoke("db:connections:test", config),

  // Active connection
  connect: (id: string): Promise<void> =>
    window.ipcRenderer.invoke("db:connect", id),
  disconnect: (): Promise<void> =>
    window.ipcRenderer.invoke("db:disconnect"),

  // Schema introspection
  getSchemas: (): Promise<string[]> =>
    window.ipcRenderer.invoke("db:schemas"),
  getTables: (schema?: string): Promise<TableInfo[]> =>
    window.ipcRenderer.invoke("db:tables", schema),
  getColumns: (schema: string, table: string): Promise<ColumnInfo[]> =>
    window.ipcRenderer.invoke("db:columns", schema, table),

  // Query execution
  executeQuery: (sql: string, connectionId?: string): Promise<QueryResult> =>
    window.ipcRenderer.invoke("db:query:execute", sql, connectionId),

  // Table data
  getTableData: (
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult> =>
    window.ipcRenderer.invoke("db:table:data", schema, table, pagination),
  getTableRowCount: (schema: string, table: string): Promise<number> =>
    window.ipcRenderer.invoke("db:table:count", schema, table),
  getPrimaryKeys: (schema: string, table: string): Promise<string[]> =>
    window.ipcRenderer.invoke("db:table:pks", schema, table),

  // Data editing
  updateCell: (update: CellUpdate): Promise<QueryResult> =>
    window.ipcRenderer.invoke("db:table:update-cell", update),
  deleteRow: (params: RowDelete): Promise<QueryResult> =>
    window.ipcRenderer.invoke("db:table:delete-row", params),
  insertRow: (params: RowInsert): Promise<QueryResult> =>
    window.ipcRenderer.invoke("db:table:insert-row", params),

  // Schema/table operations
  truncateTable: (schema: string, table: string): Promise<QueryResult> =>
    window.ipcRenderer.invoke("db:table:truncate", schema, table),
  dropTable: (schema: string, table: string, type: 'table' | 'view'): Promise<QueryResult> =>
    window.ipcRenderer.invoke("db:table:drop", schema, table, type),
  dropSchema: (schema: string, cascade: boolean): Promise<QueryResult> =>
    window.ipcRenderer.invoke("db:schema:drop", schema, cascade),
  getIndexes: (schema: string, table: string): Promise<{ name: string; columns: string; isUnique: boolean; isPrimary: boolean }[]> =>
    window.ipcRenderer.invoke("db:table:indexes", schema, table),
  getTableSize: (schema: string, table: string): Promise<{ totalSize: string; dataSize: string; indexSize: string }> =>
    window.ipcRenderer.invoke("db:table:size", schema, table),

  // Query history
  getQueryHistory: (limit?: number): Promise<QueryHistoryEntry[]> =>
    window.ipcRenderer.invoke("db:history:list", limit),
  clearQueryHistory: (): Promise<void> =>
    window.ipcRenderer.invoke("db:history:clear"),

  // Saved queries
  listSavedQueries: (): Promise<SavedQuery[]> =>
    window.ipcRenderer.invoke("db:saved:list"),
  saveQuery: (query: SavedQuery): Promise<void> =>
    window.ipcRenderer.invoke("db:saved:save", query),
  deleteSavedQuery: (id: string): Promise<void> =>
    window.ipcRenderer.invoke("db:saved:delete", id),

  // Export
  exportData: (request: ExportRequest): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    window.ipcRenderer.invoke("db:export", request),
};
