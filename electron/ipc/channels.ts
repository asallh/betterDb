export const IPC = {
  CONNECTIONS_LIST: "db:connections:list",
  CONNECTIONS_SAVE: "db:connections:save",
  CONNECTIONS_DELETE: "db:connections:delete",
  CONNECTIONS_TEST: "db:connections:test",
  CONNECTIONS_GET: "db:connections:get",

  CONNECT: "db:connect",
  DISCONNECT: "db:disconnect",

  GET_SCHEMAS: "db:schemas",
  GET_TABLES: "db:tables",
  GET_COLUMNS: "db:columns",

  EXECUTE_QUERY: "db:query:execute",

  GET_TABLE_DATA: "db:table:data",
  GET_TABLE_ROW_COUNT: "db:table:count",
  GET_PRIMARY_KEYS: "db:table:pks",

  UPDATE_CELL: "db:table:update-cell",
  DELETE_ROW: "db:table:delete-row",
  INSERT_ROW: "db:table:insert-row",

  TRUNCATE_TABLE: "db:table:truncate",
  DROP_TABLE: "db:table:drop",
  DROP_SCHEMA: "db:schema:drop",
  GET_INDEXES: "db:table:indexes",
  GET_TABLE_SIZE: "db:table:size",

  QUERY_HISTORY_LIST: "db:history:list",
  QUERY_HISTORY_CLEAR: "db:history:clear",

  SAVED_QUERIES_LIST: "db:saved:list",
  SAVED_QUERIES_SAVE: "db:saved:save",
  SAVED_QUERIES_DELETE: "db:saved:delete",

  EXPORT_DATA: "db:export",
} as const;
