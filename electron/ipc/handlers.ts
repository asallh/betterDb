import { ipcMain } from "electron";
import { IPC } from "./channels";
import { ConnectionManager } from "../db/ConnectionManager";
import {
  loadConnections,
  addOrUpdateConnection,
  deleteConnection as removeConnection,
} from "../storage/connections";
import type { ConnectionConfig, PaginationParams, CellUpdate, RowDelete, RowInsert } from "../../shared/types";

export function registerIpcHandlers(manager: ConnectionManager): void {
  // -- Connection management --
  ipcMain.handle(IPC.CONNECTIONS_LIST, async () => {
    const connections = await loadConnections();
    // Strip passwords from listing — renderer doesn't need them for display
    return connections.map(({ password: _, ...rest }) => ({
      ...rest,
      password: "",
    }));
  });

  ipcMain.handle(IPC.CONNECTIONS_GET, async (_event, id: string) => {
    const connections = await loadConnections();
    const config = connections.find((c) => c.id === id);
    if (!config) throw new Error(`Connection not found: ${id}`);
    return config;
  });

  ipcMain.handle(
    IPC.CONNECTIONS_SAVE,
    async (_event, config: ConnectionConfig) => {
      await addOrUpdateConnection(config);
    }
  );

  ipcMain.handle(IPC.CONNECTIONS_DELETE, async (_event, id: string) => {
    await removeConnection(id);
  });

  ipcMain.handle(
    IPC.CONNECTIONS_TEST,
    async (_event, config: ConnectionConfig) => {
      return manager.testConnection(config);
    }
  );

  // -- Active connection --
  ipcMain.handle(IPC.CONNECT, async (_event, id: string) => {
    const connections = await loadConnections();
    const config = connections.find((c) => c.id === id);
    if (!config) throw new Error(`Connection not found: ${id}`);
    await manager.connect(config);
  });

  ipcMain.handle(IPC.DISCONNECT, async () => {
    await manager.disconnect();
  });

  // -- Schema introspection --
  ipcMain.handle(IPC.GET_SCHEMAS, async () => {
    const adapter = manager.getActive();
    if (!adapter) throw new Error("Not connected");
    return adapter.getSchemas();
  });

  ipcMain.handle(IPC.GET_TABLES, async (_event, schema?: string) => {
    const adapter = manager.getActive();
    if (!adapter) throw new Error("Not connected");
    return adapter.getTables(schema);
  });

  ipcMain.handle(
    IPC.GET_COLUMNS,
    async (_event, schema: string, table: string) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.getColumns(schema, table);
    }
  );

  // -- Query execution --
  ipcMain.handle(IPC.EXECUTE_QUERY, async (_event, sql: string) => {
    const adapter = manager.getActive();
    if (!adapter) throw new Error("Not connected");
    return adapter.executeQuery(sql);
  });

  // -- Table data --
  ipcMain.handle(
    IPC.GET_TABLE_DATA,
    async (
      _event,
      schema: string,
      table: string,
      pagination: PaginationParams
    ) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.getTableData(schema, table, pagination);
    }
  );

  ipcMain.handle(
    IPC.GET_TABLE_ROW_COUNT,
    async (_event, schema: string, table: string) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.getTableRowCount(schema, table);
    }
  );

  ipcMain.handle(
    IPC.GET_PRIMARY_KEYS,
    async (_event, schema: string, table: string) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.getPrimaryKeys(schema, table);
    }
  );

  // -- Data editing --
  ipcMain.handle(
    IPC.UPDATE_CELL,
    async (_event, update: CellUpdate) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.updateCell(update);
    }
  );

  ipcMain.handle(
    IPC.DELETE_ROW,
    async (_event, params: RowDelete) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.deleteRow(params);
    }
  );

  ipcMain.handle(
    IPC.INSERT_ROW,
    async (_event, params: RowInsert) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.insertRow(params);
    }
  );
}
