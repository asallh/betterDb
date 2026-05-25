var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, ipcMain, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import fs from "node:fs/promises";
class DatabaseAdapter {
  constructor(config) {
    __publicField(this, "config");
    this.config = config;
  }
}
const { Pool } = pg;
class PostgresAdapter extends DatabaseAdapter {
  constructor(config) {
    super(config);
    __publicField(this, "pool", null);
  }
  async connect() {
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: 3,
      idleTimeoutMillis: 3e4
    });
    const client = await this.pool.connect();
    client.release();
  }
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
  isConnected() {
    return this.pool !== null;
  }
  async executeQuery(sql) {
    if (!this.pool) throw new Error("Not connected");
    const start = performance.now();
    try {
      const res = await this.pool.query(sql);
      const durationMs = Math.round(performance.now() - start);
      if (!res.fields || res.fields.length === 0) {
        return {
          columns: [],
          rows: [],
          rowCount: res.rowCount ?? 0,
          durationMs
        };
      }
      return {
        columns: res.fields.map((f) => f.name),
        rows: res.rows,
        rowCount: res.rows.length,
        durationMs
      };
    } catch (e) {
      const durationMs = Math.round(performance.now() - start);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs,
        error: e instanceof Error ? e.message : String(e)
      };
    }
  }
  async getSchemas() {
    if (!this.pool) throw new Error("Not connected");
    const res = await this.pool.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY schema_name`
    );
    return res.rows.map((r) => r.schema_name);
  }
  async getTables(schema) {
    if (!this.pool) throw new Error("Not connected");
    const targetSchema = schema ?? "public";
    const res = await this.pool.query(
      `SELECT table_schema, table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = $1
       ORDER BY table_name`,
      [targetSchema]
    );
    return res.rows.map((r) => ({
      schema: r.table_schema,
      name: r.table_name,
      type: r.table_type === "VIEW" ? "view" : "table"
    }));
  }
  async getColumns(schema, table) {
    if (!this.pool) throw new Error("Not connected");
    const colRes = await this.pool.query(
      `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
              c.udt_name, c.character_maximum_length
       FROM information_schema.columns c
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      [schema, table]
    );
    const pkRes = await this.pool.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = $1 AND tc.table_name = $2`,
      [schema, table]
    );
    const pkColumns = new Set(pkRes.rows.map((r) => r.column_name));
    const fkRes = await this.pool.query(
      `SELECT kcu.column_name,
              ccu.table_name AS foreign_table,
              ccu.column_name AS foreign_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = $1 AND tc.table_name = $2`,
      [schema, table]
    );
    const fkMap = new Map(
      fkRes.rows.map((r) => [
        r.column_name,
        { table: r.foreign_table, column: r.foreign_column }
      ])
    );
    return colRes.rows.map((r) => {
      let dataType = r.udt_name;
      if (r.character_maximum_length) {
        dataType += `(${r.character_maximum_length})`;
      }
      return {
        name: r.column_name,
        dataType,
        nullable: r.is_nullable === "YES",
        defaultValue: r.column_default,
        isPrimaryKey: pkColumns.has(r.column_name),
        isForeignKey: fkMap.has(r.column_name),
        references: fkMap.get(r.column_name)
      };
    });
  }
  async getTableData(schema, table, pagination) {
    const quotedTable = `"${schema}"."${table}"`;
    let sql = `SELECT * FROM ${quotedTable}`;
    if (pagination.orderBy) {
      const dir = pagination.orderDir === "DESC" ? "DESC" : "ASC";
      sql += ` ORDER BY "${pagination.orderBy}" ${dir}`;
    }
    sql += ` LIMIT ${Number(pagination.limit)} OFFSET ${Number(pagination.offset)}`;
    return this.executeQuery(sql);
  }
  async getTableRowCount(schema, table) {
    if (!this.pool) throw new Error("Not connected");
    const quotedTable = `"${schema}"."${table}"`;
    const res = await this.pool.query(
      `SELECT count(*)::int AS count FROM ${quotedTable}`
    );
    return res.rows[0].count;
  }
  async getPrimaryKeys(schema, table) {
    if (!this.pool) throw new Error("Not connected");
    const res = await this.pool.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = $1 AND tc.table_name = $2
       ORDER BY kcu.ordinal_position`,
      [schema, table]
    );
    return res.rows.map((r) => r.column_name);
  }
  async updateCell(update) {
    if (!this.pool) throw new Error("Not connected");
    const pkEntries = Object.entries(update.primaryKeys);
    if (pkEntries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No primary key — cannot identify row to update" };
    }
    const setCols = [`"${update.column}" = $1`];
    const params = [update.value === "" ? null : update.value];
    const whereParts = pkEntries.map(([col], i) => `"${col}" = $${i + 2}`);
    pkEntries.forEach(([, val]) => params.push(val));
    const sql = `UPDATE "${update.schema}"."${update.table}" SET ${setCols.join(", ")} WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();
    try {
      const res = await this.pool.query(sql, params);
      return { columns: [], rows: [], rowCount: res.rowCount ?? 0, durationMs: Math.round(performance.now() - start) };
    } catch (e) {
      return { columns: [], rows: [], rowCount: 0, durationMs: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
    }
  }
  async deleteRow(params) {
    if (!this.pool) throw new Error("Not connected");
    const pkEntries = Object.entries(params.primaryKeys);
    if (pkEntries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No primary key — cannot identify row to delete" };
    }
    const whereParts = pkEntries.map(([col], i) => `"${col}" = $${i + 1}`);
    const values = pkEntries.map(([, val]) => val);
    const sql = `DELETE FROM "${params.schema}"."${params.table}" WHERE ${whereParts.join(" AND ")}`;
    const start = performance.now();
    try {
      const res = await this.pool.query(sql, values);
      return { columns: [], rows: [], rowCount: res.rowCount ?? 0, durationMs: Math.round(performance.now() - start) };
    } catch (e) {
      return { columns: [], rows: [], rowCount: 0, durationMs: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
    }
  }
  async insertRow(params) {
    var _a;
    if (!this.pool) throw new Error("Not connected");
    const entries = Object.entries(params.values).filter(([, v]) => v !== void 0 && v !== "");
    if (entries.length === 0) {
      return { columns: [], rows: [], rowCount: 0, durationMs: 0, error: "No values provided" };
    }
    const cols = entries.map(([col]) => `"${col}"`).join(", ");
    const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
    const values = entries.map(([, val]) => val === "" ? null : val);
    const sql = `INSERT INTO "${params.schema}"."${params.table}" (${cols}) VALUES (${placeholders}) RETURNING *`;
    const start = performance.now();
    try {
      const res = await this.pool.query(sql, values);
      const durationMs = Math.round(performance.now() - start);
      return {
        columns: ((_a = res.fields) == null ? void 0 : _a.map((f) => f.name)) ?? [],
        rows: res.rows ?? [],
        rowCount: res.rowCount ?? 0,
        durationMs
      };
    } catch (e) {
      return { columns: [], rows: [], rowCount: 0, durationMs: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
    }
  }
  async testConnection() {
    const testPool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: 1,
      connectionTimeoutMillis: 5e3
    });
    try {
      const client = await testPool.connect();
      client.release();
      await testPool.end();
      return { success: true };
    } catch (e) {
      try {
        await testPool.end();
      } catch {
      }
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      };
    }
  }
}
class ConnectionManager {
  constructor() {
    __publicField(this, "activeAdapter", null);
    __publicField(this, "activeConnectionId", null);
  }
  createAdapter(config) {
    switch (config.engine) {
      case "postgres":
        return new PostgresAdapter(config);
      default:
        throw new Error(`Unsupported engine: ${config.engine}`);
    }
  }
  async connect(config) {
    if (this.activeAdapter) {
      await this.disconnect();
    }
    const adapter = this.createAdapter(config);
    await adapter.connect();
    this.activeAdapter = adapter;
    this.activeConnectionId = config.id;
  }
  async disconnect() {
    if (this.activeAdapter) {
      await this.activeAdapter.disconnect();
      this.activeAdapter = null;
      this.activeConnectionId = null;
    }
  }
  getActive() {
    return this.activeAdapter;
  }
  getActiveConnectionId() {
    return this.activeConnectionId;
  }
  async testConnection(config) {
    const adapter = this.createAdapter(config);
    return adapter.testConnection();
  }
}
const IPC = {
  CONNECTIONS_LIST: "db:connections:list",
  CONNECTIONS_SAVE: "db:connections:save",
  CONNECTIONS_DELETE: "db:connections:delete",
  CONNECTIONS_TEST: "db:connections:test",
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
  INSERT_ROW: "db:table:insert-row"
};
function getFilePath() {
  return path.join(app.getPath("userData"), "connections.json");
}
async function loadConnections() {
  try {
    const data = await fs.readFile(getFilePath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}
async function saveConnections(connections) {
  const filePath = getFilePath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(connections, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}
async function addOrUpdateConnection(config) {
  const connections = await loadConnections();
  const index = connections.findIndex((c) => c.id === config.id);
  if (index >= 0) {
    connections[index] = config;
  } else {
    connections.push(config);
  }
  await saveConnections(connections);
}
async function deleteConnection(id) {
  const connections = await loadConnections();
  await saveConnections(connections.filter((c) => c.id !== id));
}
function registerIpcHandlers(manager) {
  ipcMain.handle(IPC.CONNECTIONS_LIST, async () => {
    return loadConnections();
  });
  ipcMain.handle(
    IPC.CONNECTIONS_SAVE,
    async (_event, config) => {
      await addOrUpdateConnection(config);
    }
  );
  ipcMain.handle(IPC.CONNECTIONS_DELETE, async (_event, id) => {
    await deleteConnection(id);
  });
  ipcMain.handle(
    IPC.CONNECTIONS_TEST,
    async (_event, config) => {
      return manager.testConnection(config);
    }
  );
  ipcMain.handle(IPC.CONNECT, async (_event, id) => {
    const connections = await loadConnections();
    const config = connections.find((c) => c.id === id);
    if (!config) throw new Error(`Connection not found: ${id}`);
    await manager.connect(config);
  });
  ipcMain.handle(IPC.DISCONNECT, async () => {
    await manager.disconnect();
  });
  ipcMain.handle(IPC.GET_SCHEMAS, async () => {
    const adapter = manager.getActive();
    if (!adapter) throw new Error("Not connected");
    return adapter.getSchemas();
  });
  ipcMain.handle(IPC.GET_TABLES, async (_event, schema) => {
    const adapter = manager.getActive();
    if (!adapter) throw new Error("Not connected");
    return adapter.getTables(schema);
  });
  ipcMain.handle(
    IPC.GET_COLUMNS,
    async (_event, schema, table) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.getColumns(schema, table);
    }
  );
  ipcMain.handle(IPC.EXECUTE_QUERY, async (_event, sql) => {
    const adapter = manager.getActive();
    if (!adapter) throw new Error("Not connected");
    return adapter.executeQuery(sql);
  });
  ipcMain.handle(
    IPC.GET_TABLE_DATA,
    async (_event, schema, table, pagination) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.getTableData(schema, table, pagination);
    }
  );
  ipcMain.handle(
    IPC.GET_TABLE_ROW_COUNT,
    async (_event, schema, table) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.getTableRowCount(schema, table);
    }
  );
  ipcMain.handle(
    IPC.GET_PRIMARY_KEYS,
    async (_event, schema, table) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.getPrimaryKeys(schema, table);
    }
  );
  ipcMain.handle(
    IPC.UPDATE_CELL,
    async (_event, update) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.updateCell(update);
    }
  );
  ipcMain.handle(
    IPC.DELETE_ROW,
    async (_event, params) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.deleteRow(params);
    }
  );
  ipcMain.handle(
    IPC.INSERT_ROW,
    async (_event, params) => {
      const adapter = manager.getActive();
      if (!adapter) throw new Error("Not connected");
      return adapter.insertRow(params);
    }
  );
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const connectionManager = new ConnectionManager();
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: "BetterDB",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  registerIpcHandlers(connectionManager);
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
