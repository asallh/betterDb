import {
  MongoClient,
  ObjectId,
  type Db,
  type Document,
  type MongoClientOptions,
} from "mongodb";
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

const SYSTEM_DATABASES = new Set(["admin", "local", "config"]);

type FlattenedRow = Record<string, unknown>;

function inferBsonType(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (value instanceof ObjectId) return "objectId";
  if (Buffer.isBuffer(value)) return "binData";
  if (typeof value === "object") return "object";
  return typeof value;
}

function flattenValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    try {
      return JSON.stringify(value, (_key, v) => {
        if (v instanceof ObjectId) return v.toHexString();
        if (v instanceof Date) return v.toISOString();
        if (Buffer.isBuffer(v)) return v.toString("base64");
        return v;
      });
    } catch {
      return String(value);
    }
  }
  return value;
}

function flattenDocument(doc: Document): FlattenedRow {
  const row: FlattenedRow = {};
  for (const [key, value] of Object.entries(doc)) {
    row[key] = flattenValue(value);
  }
  return row;
}

function rowsToQueryResult(
  rows: FlattenedRow[],
  durationMs: number,
  rowCountOverride?: number
): QueryResult {
  const columnSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) columnSet.add(key);
  }
  // Prefer _id first when present
  const columns = Array.from(columnSet);
  if (columns.includes("_id")) {
    columns.splice(columns.indexOf("_id"), 1);
    columns.unshift("_id");
  }
  const first = rows[0];
  return {
    columns,
    columnTypes: columns.map((name) => ({
      name,
      dataType: first ? inferBsonType(first[name]) : "unknown",
    })),
    rows,
    rowCount: rowCountOverride ?? rows.length,
    durationMs,
  };
}

function parseObjectId(value: unknown): unknown {
  if (value instanceof ObjectId) return value;
  if (typeof value === "string" && ObjectId.isValid(value) && value.length === 24) {
    try {
      return new ObjectId(value);
    } catch {
      return value;
    }
  }
  return value;
}

function coerceCellValue(value: unknown): unknown {
  if (value === "" || value === undefined) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isNaN(n)) return n;
  }
  return value;
}

function formatBytes(bytes: number | undefined | null): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${bytes} B`;
}

export class MongoAdapter extends DatabaseAdapter {
  private client: MongoClient | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  private buildUri(): string {
    if (this.config.connectionString?.trim()) {
      const base = this.config.connectionString.trim();
      // Append database path if missing and config.database is set
      if (this.config.database && !/\/[^/?]+(\?|$)/.test(base.replace(/^mongodb(\+srv)?:\/\//, ""))) {
        const hasQuery = base.includes("?");
        const [withoutQuery, query] = hasQuery ? base.split("?") : [base, ""];
        const needsSlash = !withoutQuery.endsWith("/");
        return `${withoutQuery}${needsSlash ? "/" : ""}${encodeURIComponent(this.config.database)}${query ? `?${query}` : ""}`;
      }
      return base;
    }

    const host = this.config.host || "localhost";
    const port = this.config.port || 27017;
    const useSrv =
      this.config.ssl === true &&
      !host.includes(":") &&
      (host.includes("mongodb.net") || host.includes("."));

    let auth = "";
    if (this.config.user) {
      const user = encodeURIComponent(this.config.user);
      const pass = encodeURIComponent(this.config.password ?? "");
      auth = `${user}:${pass}@`;
    }

    const dbPath = this.config.database
      ? `/${encodeURIComponent(this.config.database)}`
      : "/";

    const params = new URLSearchParams();
    if (this.config.ssl) {
      params.set("tls", "true");
      if (this.config.sslRejectUnauthorized === false) {
        params.set("tlsAllowInvalidCertificates", "true");
      }
    }
    // Docker official mongo image creates the root user in the admin DB.
    if (this.config.docker?.managed && this.config.user) {
      params.set("authSource", "admin");
    }

    const query = params.toString() ? `?${params.toString()}` : "";

    if (useSrv) {
      return `mongodb+srv://${auth}${host}${dbPath}${query}`;
    }
    return `mongodb://${auth}${host}:${port}${dbPath}${query}`;
  }

  private clientOptions(): MongoClientOptions {
    return {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    };
  }

  private getClient(): MongoClient {
    if (!this.client) throw new Error("Not connected");
    return this.client;
  }

  private db(name?: string): Db {
    const client = this.getClient();
    return client.db(name || this.config.database || undefined);
  }

  async connect(): Promise<void> {
    const client = new MongoClient(this.buildUri(), this.clientOptions());
    await client.connect();
    this.client = client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async getSchemas(): Promise<string[]> {
    const admin = this.getClient().db().admin();
    const { databases } = await admin.listDatabases();
    return databases
      .map((d) => d.name)
      .filter((name) => !SYSTEM_DATABASES.has(name))
      .sort((a, b) => a.localeCompare(b));
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const dbName = schema || this.config.database || "test";
    const collections = await this.db(dbName).listCollections().toArray();
    return collections
      .map((c) => ({
        schema: dbName,
        name: c.name,
        type: "table" as const,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const coll = this.db(schema).collection(table);
    const docs = await coll.find({}).limit(50).toArray();
    const typeMap = new Map<string, string>();

    for (const doc of docs) {
      for (const [key, value] of Object.entries(doc)) {
        if (!typeMap.has(key)) {
          typeMap.set(key, inferBsonType(value));
        }
      }
    }

    if (!typeMap.has("_id")) {
      typeMap.set("_id", "objectId");
    }

    const columns: ColumnInfo[] = [];
    // _id first
    columns.push({
      name: "_id",
      dataType: typeMap.get("_id") ?? "objectId",
      nullable: false,
      defaultValue: null,
      isPrimaryKey: true,
      isForeignKey: false,
    });
    typeMap.delete("_id");

    for (const [name, dataType] of Array.from(typeMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      columns.push({
        name,
        dataType,
        nullable: true,
        defaultValue: null,
        isPrimaryKey: false,
        isForeignKey: false,
      });
    }
    return columns;
  }

  async getTableData(
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult> {
    const start = performance.now();
    try {
      const coll = this.db(schema).collection(table);
      let cursor = coll.find({});

      if (pagination.orderBy) {
        const dir = pagination.orderDir === "DESC" ? -1 : 1;
        cursor = cursor.sort({ [pagination.orderBy]: dir });
      }

      const docs = await cursor
        .skip(Number(pagination.offset) || 0)
        .limit(Number(pagination.limit) || 100)
        .toArray();

      const rows = docs.map(flattenDocument);
      return rowsToQueryResult(rows, Math.round(performance.now() - start));
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async getTableRowCount(schema: string, table: string): Promise<number> {
    const coll = this.db(schema).collection(table);
    try {
      return await coll.estimatedDocumentCount();
    } catch {
      return coll.countDocuments();
    }
  }

  async getPrimaryKeys(_schema: string, _table: string): Promise<string[]> {
    return ["_id"];
  }

  async executeQuery(text: string): Promise<QueryResult> {
    const start = performance.now();
    try {
      const command = this.parseCommand(text);
      const dbName =
        (typeof command.db === "string" && command.db) ||
        this.config.database ||
        undefined;
      const db = this.db(dbName);

      if ("find" in command && typeof command.find === "string") {
        const filter = (command.filter as Document) ?? {};
        const limit = typeof command.limit === "number" ? command.limit : 100;
        const skip = typeof command.skip === "number" ? command.skip : 0;
        const projection = (command.projection as Document) ?? undefined;
        const sort = (command.sort as Document) ?? undefined;
        let cursor = db.collection(command.find).find(filter, { projection });
        if (sort) cursor = cursor.sort(sort);
        const docs = await cursor.skip(skip).limit(limit).toArray();
        return rowsToQueryResult(
          docs.map(flattenDocument),
          Math.round(performance.now() - start)
        );
      }

      if ("aggregate" in command && typeof command.aggregate === "string") {
        const pipeline = Array.isArray(command.pipeline) ? command.pipeline : [];
        const docs = await db
          .collection(command.aggregate)
          .aggregate(pipeline as Document[])
          .toArray();
        return rowsToQueryResult(
          docs.map(flattenDocument),
          Math.round(performance.now() - start)
        );
      }

      if ("insert" in command && typeof command.insert === "string") {
        const documents = Array.isArray(command.documents) ? command.documents : [];
        if (documents.length === 0) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            durationMs: Math.round(performance.now() - start),
            error: "insert requires a non-empty documents array",
          };
        }
        const result = await db.collection(command.insert).insertMany(documents as Document[]);
        return {
          columns: ["insertedCount", "insertedIds"],
          rows: [
            {
              insertedCount: result.insertedCount,
              insertedIds: JSON.stringify(Object.values(result.insertedIds).map(String)),
            },
          ],
          rowCount: result.insertedCount,
          durationMs: Math.round(performance.now() - start),
        };
      }

      if ("update" in command && typeof command.update === "string") {
        const updates = Array.isArray(command.updates) ? command.updates : [];
        let matched = 0;
        let modified = 0;
        for (const u of updates) {
          const q = (u?.q as Document) ?? {};
          const updateDoc = (u?.u as Document) ?? {};
          const multi = Boolean(u?.multi);
          if (multi) {
            const res = await db.collection(command.update).updateMany(q, updateDoc);
            matched += res.matchedCount;
            modified += res.modifiedCount;
          } else {
            const res = await db.collection(command.update).updateOne(q, updateDoc);
            matched += res.matchedCount;
            modified += res.modifiedCount;
          }
        }
        return {
          columns: ["matchedCount", "modifiedCount"],
          rows: [{ matchedCount: matched, modifiedCount: modified }],
          rowCount: modified,
          durationMs: Math.round(performance.now() - start),
        };
      }

      if ("delete" in command && typeof command.delete === "string") {
        const deletes = Array.isArray(command.deletes) ? command.deletes : [];
        let deleted = 0;
        for (const d of deletes) {
          const q = (d?.q as Document) ?? {};
          const limit = typeof d?.limit === "number" ? d.limit : 1;
          if (limit === 0) {
            const res = await db.collection(command.delete).deleteMany(q);
            deleted += res.deletedCount ?? 0;
          } else {
            const res = await db.collection(command.delete).deleteOne(q);
            deleted += res.deletedCount ?? 0;
          }
        }
        return {
          columns: ["deletedCount"],
          rows: [{ deletedCount: deleted }],
          rowCount: deleted,
          durationMs: Math.round(performance.now() - start),
        };
      }

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error:
          'Unsupported MongoDB command. Use {"find":"..."}, {"aggregate":"..."}, {"insert":"..."}, {"update":"..."}, or {"delete":"..."}',
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  private parseCommand(text: string): Record<string, unknown> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Empty query");

    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return parsed;
    }

    // Sugar: db.collection.find({...}) or collection.find({...})
    const findMatch = trimmed.match(
      /^(?:db\.)?([A-Za-z0-9_.-]+)\.find\s*\(\s*(\{[\s\S]*\})?\s*\)/
    );
    if (findMatch) {
      return {
        find: findMatch[1],
        filter: findMatch[2] ? JSON.parse(findMatch[2]) : {},
        limit: 100,
      };
    }

    const aggMatch = trimmed.match(
      /^(?:db\.)?([A-Za-z0-9_.-]+)\.aggregate\s*\(\s*(\[[\s\S]*\])\s*\)/
    );
    if (aggMatch) {
      return {
        aggregate: aggMatch[1],
        pipeline: JSON.parse(aggMatch[2]),
      };
    }

    // Fallback: try JSON again after wrapping
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      throw new Error(
        'Could not parse MongoDB query. Provide JSON like {"find":"users","filter":{},"limit":100}'
      );
    }
  }

  async updateCell(update: CellUpdate): Promise<QueryResult> {
    const start = performance.now();
    try {
      const idVal = update.primaryKeys._id;
      if (idVal === undefined || idVal === null || idVal === "") {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          durationMs: 0,
          error: "No _id — cannot identify document to update",
        };
      }
      const filter = { _id: parseObjectId(idVal) };
      const value = coerceCellValue(update.value);
      const res = await this.db(update.schema)
        .collection(update.table)
        .updateOne(filter as Document, { $set: { [update.column]: value } });
      return {
        columns: [],
        rows: [],
        rowCount: res.modifiedCount,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async deleteRow(params: RowDelete): Promise<QueryResult> {
    const start = performance.now();
    try {
      const idVal = params.primaryKeys._id;
      if (idVal === undefined || idVal === null || idVal === "") {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          durationMs: 0,
          error: "No _id — cannot identify document to delete",
        };
      }
      const res = await this.db(params.schema)
        .collection(params.table)
        .deleteOne({ _id: parseObjectId(idVal) } as Document);
      return {
        columns: [],
        rows: [],
        rowCount: res.deletedCount ?? 0,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async insertRow(params: RowInsert): Promise<QueryResult> {
    const start = performance.now();
    try {
      const doc: Document = {};
      for (const [key, raw] of Object.entries(params.values)) {
        if (raw === undefined || raw === "") continue;
        if (key === "_id") {
          doc._id = parseObjectId(raw);
        } else {
          doc[key] = coerceCellValue(raw);
        }
      }
      const res = await this.db(params.schema).collection(params.table).insertOne(doc);
      return {
        columns: ["_id"],
        rows: [{ _id: String(res.insertedId) }],
        rowCount: 1,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async truncateTable(schema: string, table: string): Promise<QueryResult> {
    const start = performance.now();
    try {
      const res = await this.db(schema).collection(table).deleteMany({});
      return {
        columns: [],
        rows: [],
        rowCount: res.deletedCount ?? 0,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async dropTable(
    schema: string,
    table: string,
    _type: "table" | "view"
  ): Promise<QueryResult> {
    const start = performance.now();
    try {
      await this.db(schema).collection(table).drop();
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async dropSchema(schema: string, _cascade: boolean): Promise<QueryResult> {
    const start = performance.now();
    try {
      await this.db(schema).dropDatabase();
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (e: unknown) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async getIndexes(
    schema: string,
    table: string
  ): Promise<{ name: string; columns: string; isUnique: boolean; isPrimary: boolean }[]> {
    const indexes = await this.db(schema).collection(table).indexes();
    return indexes.map((idx) => {
      const key = (idx.key ?? {}) as Record<string, unknown>;
      const columns = Object.entries(key)
        .map(([col, dir]) => `${col}:${dir}`)
        .join(", ");
      const name = String(idx.name ?? columns);
      const isPrimary = name === "_id_" || Object.keys(key).length === 1 && "_id" in key;
      return {
        name,
        columns,
        isUnique: Boolean(idx.unique) || isPrimary,
        isPrimary,
      };
    });
  }

  async getTableSize(
    schema: string,
    table: string
  ): Promise<{ totalSize: string; dataSize: string; indexSize: string }> {
    try {
      const stats = (await this.db(schema).command({ collStats: table })) as {
        size?: number;
        storageSize?: number;
        totalIndexSize?: number;
      };
      const data = stats.size ?? stats.storageSize ?? 0;
      const index = stats.totalIndexSize ?? 0;
      const total = data + index;
      return {
        totalSize: formatBytes(total),
        dataSize: formatBytes(data),
        indexSize: formatBytes(index),
      };
    } catch {
      return { totalSize: "—", dataSize: "—", indexSize: "—" };
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    let client: MongoClient | null = null;
    try {
      client = new MongoClient(this.buildUri(), {
        ...this.clientOptions(),
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      await client.db().command({ ping: 1 });
      return { success: true };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    } finally {
      if (client) await client.close().catch(() => {});
    }
  }
}
