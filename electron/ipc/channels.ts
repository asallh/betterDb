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
} as const;
