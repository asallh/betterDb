import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "node:fs/promises";
import { IPC } from "./channels";
import { ConnectionManager } from "../db/ConnectionManager";
import {
  loadConnections,
  addOrUpdateConnection,
  deleteConnection as removeConnection,
} from "../storage/connections";
import {
  loadHistory,
  addHistoryEntry,
  clearHistory,
} from "../storage/queryHistory";
import {
  loadSavedQueries,
  saveQuery,
  deleteSavedQuery,
} from "../storage/savedQueries";
import type {
  ConnectionConfig,
  PaginationParams,
  CellUpdate,
  RowDelete,
  RowInsert,
  QueryHistoryEntry,
  SavedQuery,
  ExportRequest,
} from "../../shared/types";

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
  ipcMain.handle(
    IPC.EXECUTE_QUERY,
    async (_event, sql: string, connectionId?: string) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      const result = await adapter.executeQuery(sql);

      // Auto-save to history
      const entry: QueryHistoryEntry = {
        id: crypto.randomUUID(),
        sql,
        connectionId: connectionId ?? "",
        executedAt: new Date().toISOString(),
        durationMs: result.durationMs,
        rowCount: result.rowCount,
        error: result.error,
      };
      addHistoryEntry(entry).catch(() => {});

      return result;
    }
  );

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

  // -- Schema/table operations --
  ipcMain.handle(
    IPC.TRUNCATE_TABLE,
    async (_event, schema: string, table: string) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.truncateTable(schema, table);
    }
  );

  ipcMain.handle(
    IPC.DROP_TABLE,
    async (_event, schema: string, table: string, type: 'table' | 'view') => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.dropTable(schema, table, type);
    }
  );

  ipcMain.handle(
    IPC.DROP_SCHEMA,
    async (_event, schema: string, cascade: boolean) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.dropSchema(schema, cascade);
    }
  );

  ipcMain.handle(
    IPC.GET_INDEXES,
    async (_event, schema: string, table: string) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.getIndexes(schema, table);
    }
  );

  ipcMain.handle(
    IPC.GET_TABLE_SIZE,
    async (_event, schema: string, table: string) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.getTableSize(schema, table);
    }
  );

  // -- Query history --
  ipcMain.handle(
    IPC.QUERY_HISTORY_LIST,
    async (_event, limit?: number) => {
      return loadHistory(limit);
    }
  );

  ipcMain.handle(IPC.QUERY_HISTORY_CLEAR, async () => {
    await clearHistory();
  });

  // -- Saved queries --
  ipcMain.handle(IPC.SAVED_QUERIES_LIST, async () => {
    return loadSavedQueries();
  });

  ipcMain.handle(
    IPC.SAVED_QUERIES_SAVE,
    async (_event, query: SavedQuery) => {
      await saveQuery(query);
    }
  );

  ipcMain.handle(
    IPC.SAVED_QUERIES_DELETE,
    async (_event, id: string) => {
      await deleteSavedQuery(id);
    }
  );

  // -- Export --
  ipcMain.handle(
    IPC.EXPORT_DATA,
    async (_event, request: ExportRequest) => {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) return { success: false, error: "No active window" };

      const ext = request.format === "csv" ? "csv" : "json";
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: `${request.suggestedName ?? "export"}.${ext}`,
        filters: [
          request.format === "csv"
            ? { name: "CSV", extensions: ["csv"] }
            : { name: "JSON", extensions: ["json"] },
        ],
      });

      if (canceled || !filePath) return { success: false };

      let content: string;
      if (request.format === "csv") {
        const escapeCsv = (val: unknown): string => {
          if (val === null || val === undefined) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        const header = request.columns.map(escapeCsv).join(",");
        const rows = request.rows.map((row) =>
          request.columns.map((col) => escapeCsv(row[col])).join(",")
        );
        content = [header, ...rows].join("\n");
      } else {
        content = JSON.stringify(request.rows, null, 2);
      }

      await fs.writeFile(filePath, content, "utf-8");
      return { success: true, filePath };
    }
  );
}
