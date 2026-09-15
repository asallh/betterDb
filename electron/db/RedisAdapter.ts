import Redis, { type RedisOptions } from "ioredis";
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

const KEY_TYPES = ["string", "hash", "list", "set", "zset"] as const;
type RedisKeyType = (typeof KEY_TYPES)[number];

const FIXED_COLUMNS: ColumnInfo[] = [
  {
    name: "key",
    dataType: "string",
    nullable: false,
    defaultValue: null,
    isPrimaryKey: true,
    isForeignKey: false,
  },
  {
    name: "type",
    dataType: "string",
    nullable: false,
    defaultValue: null,
    isPrimaryKey: false,
    isForeignKey: false,
  },
  {
    name: "ttl",
    dataType: "integer",
    nullable: false,
    defaultValue: null,
    isPrimaryKey: false,
    isForeignKey: false,
  },
  {
    name: "value",
    dataType: "string",
    nullable: true,
    defaultValue: null,
    isPrimaryKey: false,
    isForeignKey: false,
  },
];

function isKeyType(value: string): value is RedisKeyType {
  return (KEY_TYPES as readonly string[]).includes(value);
}

/** Split a Redis CLI command respecting single/double quotes. */
function splitRedisCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\" && quote === '"') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

function previewValue(raw: unknown, maxLen = 200): string {
  let text: string;
  if (raw === null || raw === undefined) {
    text = "";
  } else if (typeof raw === "string") {
    text = raw;
  } else if (Array.isArray(raw)) {
    // HGETALL returns flat array [k,v,k,v...] from ioredis depending on version;
    // when already object, stringify.
    text = JSON.stringify(raw);
  } else if (typeof raw === "object") {
    text = JSON.stringify(raw);
  } else {
    text = String(raw);
  }
  if (text.length > maxLen) return `${text.slice(0, maxLen)}…`;
  return text;
}

function normalizeReply(reply: unknown): QueryResult["rows"] {
  if (reply === null || reply === undefined) {
    return [{ result: null }];
  }
  if (typeof reply === "string" || typeof reply === "number" || typeof reply === "boolean") {
    return [{ result: reply }];
  }
  if (Buffer.isBuffer(reply)) {
    return [{ result: reply.toString("utf8") }];
  }
  if (Array.isArray(reply)) {
    // Flat array → one column rows, or pairs if even length looks like hash
    if (reply.length === 0) return [];
    const allPrimitive = reply.every(
      (v) =>
        v === null ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        Buffer.isBuffer(v)
    );
    if (allPrimitive) {
      return reply.map((v, i) => ({
        index: i,
        value: Buffer.isBuffer(v) ? v.toString("utf8") : v,
      }));
    }
    // Nested arrays (e.g. SCAN cursor + keys)
    return reply.map((v, i) => ({
      index: i,
      value: typeof v === "object" ? JSON.stringify(v) : v,
    }));
  }
  if (typeof reply === "object") {
    return [reply as Record<string, unknown>];
  }
  return [{ result: String(reply) }];
}

export class RedisAdapter extends DatabaseAdapter {
  private client: Redis | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  private dbIndex(schema?: string): number {
    const raw = schema ?? this.config.database ?? "0";
    const n = Number.parseInt(String(raw), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  private buildOptions(db?: number): RedisOptions {
    const options: RedisOptions = {
      host: this.config.host || "127.0.0.1",
      port: this.config.port || 6379,
      db: db ?? this.dbIndex(),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 8000,
      enableReadyCheck: true,
    };

    if (this.config.password) {
      options.password = this.config.password;
    }
    if (this.config.user) {
      options.username = this.config.user;
    }
    if (this.config.ssl) {
      options.tls = {
        rejectUnauthorized: this.config.sslRejectUnauthorized !== false,
      };
    }

    if (this.config.connectionString?.trim()) {
      // Prefer URI when provided; still allow db override via SELECT later
      return {
        ...options,
        // ioredis accepts URL via constructor separately; keep host options as fallback
      };
    }

    return options;
  }

  private getClient(): Redis {
    if (!this.client) throw new Error("Not connected");
    return this.client;
  }

  private async withDb<T>(schema: string | undefined, fn: (redis: Redis) => Promise<T>): Promise<T> {
    const redis = this.getClient();
    const target = this.dbIndex(schema);
    const current = redis.options.db ?? 0;
    if (target !== current) {
      await redis.select(target);
    }
    try {
      return await fn(redis);
    } finally {
      // Restore configured default db
      const home = this.dbIndex();
      if (target !== home) {
        await redis.select(home).catch(() => {});
      }
    }
  }

  async connect(): Promise<void> {
    const db = this.dbIndex();
    let client: Redis;
    if (this.config.connectionString?.trim()) {
      client = new Redis(this.config.connectionString.trim(), {
        db,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 8000,
      });
    } else {
      client = new Redis(this.buildOptions(db));
    }
    await client.connect();
    this.client = client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        this.client.disconnect();
      } catch {
        // ignore
      }
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async getSchemas(): Promise<string[]> {
    return this.withDb(undefined, async (redis) => {
      try {
        const raw = await redis.config("GET", "databases");
        // CONFIG GET returns [key, value] or object depending on version
        let count = 16;
        if (Array.isArray(raw) && raw.length >= 2) {
          count = Number.parseInt(String(raw[1]), 10) || 16;
        } else if (raw && typeof raw === "object" && !Array.isArray(raw) && "databases" in raw) {
          count =
            Number.parseInt(String((raw as unknown as Record<string, string>).databases), 10) ||
            16;
        }
        return Array.from({ length: count }, (_, i) => String(i));
      } catch {
        return Array.from({ length: 16 }, (_, i) => String(i));
      }
    });
  }

  async getTables(schema?: string): Promise<TableInfo[]> {
    const db = String(this.dbIndex(schema));
    return KEY_TYPES.map((name) => ({
      schema: db,
      name,
      type: "table" as const,
    }));
  }

  async getColumns(_schema: string, _table: string): Promise<ColumnInfo[]> {
    return FIXED_COLUMNS.map((c) => ({ ...c }));
  }

  private async scanKeysOfType(
    redis: Redis,
    type: RedisKeyType,
    offset: number,
    limit: number
  ): Promise<{ keys: string[]; total: number }> {
    const matched: string[] = [];
    let cursor = "0";
    let scannedMatching = 0;

    do {
      const [next, batch] = await redis.scan(cursor, "COUNT", 200);
      cursor = next;
      for (const key of batch) {
        const t = await redis.type(key);
        if (t !== type) continue;
        if (scannedMatching >= offset && matched.length < limit) {
          matched.push(key);
        }
        scannedMatching++;
      }
    } while (cursor !== "0");

    return { keys: matched, total: scannedMatching };
  }

  private async valuePreview(redis: Redis, key: string, type: string): Promise<string> {
    switch (type) {
      case "string": {
        const v = await redis.get(key);
        return previewValue(v);
      }
      case "hash": {
        const v = await redis.hgetall(key);
        return previewValue(v);
      }
      case "list": {
        const len = await redis.llen(key);
        const sample = await redis.lrange(key, 0, 9);
        return previewValue({ length: len, sample });
      }
      case "set": {
        const card = await redis.scard(key);
        const sample = await redis.srandmember(key, String(10));
        return previewValue({ cardinality: card, sample });
      }
      case "zset": {
        const card = await redis.zcard(key);
        const sample = await redis.zrange(key, "0", "9", "WITHSCORES");
        return previewValue({ cardinality: card, sample });
      }
      default:
        return "";
    }
  }

  async getTableData(
    schema: string,
    table: string,
    pagination: PaginationParams
  ): Promise<QueryResult> {
    const start = performance.now();
    if (!isKeyType(table)) {
      return {
        columns: ["key", "type", "ttl", "value"],
        rows: [],
        rowCount: 0,
        durationMs: Math.round(performance.now() - start),
        error: `Unknown Redis key type table: ${table}`,
      };
    }

    try {
      return await this.withDb(schema, async (redis) => {
        const offset = Number(pagination.offset) || 0;
        const limit = Number(pagination.limit) || 100;
        const { keys } = await this.scanKeysOfType(redis, table, offset, limit);

        // Optional order by key
        let ordered = keys;
        if (pagination.orderBy === "key") {
          ordered = [...keys].sort((a, b) =>
            pagination.orderDir === "DESC" ? b.localeCompare(a) : a.localeCompare(b)
          );
        }

        const rows: Record<string, unknown>[] = [];
        for (const key of ordered) {
          const ttl = await redis.ttl(key);
          const value = await this.valuePreview(redis, key, table);
          rows.push({ key, type: table, ttl, value });
        }

        return {
          columns: ["key", "type", "ttl", "value"],
          columnTypes: [
            { name: "key", dataType: "string" },
            { name: "type", dataType: "string" },
            { name: "ttl", dataType: "integer" },
            { name: "value", dataType: "string" },
          ],
          rows,
          rowCount: rows.length,
          durationMs: Math.round(performance.now() - start),
        };
      });
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
    if (!isKeyType(table)) return 0;
    return this.withDb(schema, async (redis) => {
      const { total } = await this.scanKeysOfType(redis, table, 0, 0);
      return total;
    });
  }

  async getPrimaryKeys(_schema: string, _table: string): Promise<string[]> {
    return ["key"];
  }

  async executeQuery(text: string): Promise<QueryResult> {
    const start = performance.now();
    try {
      const tokens = splitRedisCommand(text.trim());
      if (tokens.length === 0) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          durationMs: 0,
          error: "Empty Redis command",
        };
      }
      const [cmd, ...args] = tokens;
      const reply = await this.getClient().call(cmd, ...args);
      const rows = normalizeReply(reply);
      const columns =
        rows.length > 0 ? Object.keys(rows[0]) : ["result"];
      return {
        columns,
        rows,
        rowCount: rows.length,
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

  async updateCell(update: CellUpdate): Promise<QueryResult> {
    const start = performance.now();
    try {
      const key = String(update.primaryKeys.key ?? "");
      if (!key) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          durationMs: 0,
          error: "No key — cannot identify Redis entry to update",
        };
      }

      return await this.withDb(update.schema, async (redis) => {
        if (update.column !== "value") {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            durationMs: Math.round(performance.now() - start),
            error: `Updating column "${update.column}" is not supported; only "value" can be edited`,
          };
        }

        const type = await redis.type(key);
        if (type === "string" || update.table === "string") {
          await redis.set(key, String(update.value ?? ""));
          return {
            columns: [],
            rows: [],
            rowCount: 1,
            durationMs: Math.round(performance.now() - start),
          };
        }

        if (type === "hash") {
          // Limited: expect value as JSON object of field→value
          const raw = update.value;
          let fields: Record<string, string>;
          if (typeof raw === "string") {
            try {
              fields = JSON.parse(raw) as Record<string, string>;
            } catch {
              return {
                columns: [],
                rows: [],
                rowCount: 0,
                durationMs: Math.round(performance.now() - start),
                error: "Hash value must be a JSON object of field→value pairs",
              };
            }
          } else if (raw && typeof raw === "object") {
            fields = Object.fromEntries(
              Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, String(v)])
            );
          } else {
            return {
              columns: [],
              rows: [],
              rowCount: 0,
              durationMs: Math.round(performance.now() - start),
              error: "Hash value must be a JSON object",
            };
          }
          const flat: string[] = [];
          for (const [k, v] of Object.entries(fields)) {
            flat.push(k, String(v));
          }
          if (flat.length > 0) await redis.hset(key, ...flat);
          return {
            columns: [],
            rows: [],
            rowCount: 1,
            durationMs: Math.round(performance.now() - start),
          };
        }

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          durationMs: Math.round(performance.now() - start),
          error: `updateCell is only supported for string (and limited hash) keys; got type ${type}`,
        };
      });
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
      const key = String(params.primaryKeys.key ?? "");
      if (!key) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          durationMs: 0,
          error: "No key — cannot identify Redis entry to delete",
        };
      }
      return await this.withDb(params.schema, async (redis) => {
        const n = await redis.del(key);
        return {
          columns: [],
          rows: [],
          rowCount: n,
          durationMs: Math.round(performance.now() - start),
        };
      });
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
      const key = String(params.values.key ?? "");
      const value = params.values.value;
      if (!key) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          durationMs: 0,
          error: "insertRow requires a key",
        };
      }
      return await this.withDb(params.schema, async (redis) => {
        if (params.table === "string" || !params.table) {
          await redis.set(key, String(value ?? ""));
        } else if (params.table === "hash") {
          let fields: Record<string, string> = {};
          if (typeof value === "string") {
            try {
              fields = JSON.parse(value) as Record<string, string>;
            } catch {
              fields = { value: value };
            }
          } else if (value && typeof value === "object") {
            fields = Object.fromEntries(
              Object.entries(value as Record<string, unknown>).map(([k, v]) => [
                k,
                String(v),
              ])
            );
          }
          const flat: string[] = [];
          for (const [k, v] of Object.entries(fields)) flat.push(k, v);
          if (flat.length > 0) await redis.hset(key, ...flat);
          else await redis.hset(key, "field", "");
        } else if (params.table === "list") {
          await redis.rpush(key, String(value ?? ""));
        } else if (params.table === "set") {
          await redis.sadd(key, String(value ?? ""));
        } else if (params.table === "zset") {
          await redis.zadd(key, 0, String(value ?? ""));
        } else {
          await redis.set(key, String(value ?? ""));
        }
        return {
          columns: ["key"],
          rows: [{ key }],
          rowCount: 1,
          durationMs: Math.round(performance.now() - start),
        };
      });
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

  private async deleteKeysOfType(schema: string, table: string): Promise<number> {
    if (!isKeyType(table)) return 0;
    return this.withDb(schema, async (redis) => {
      let deleted = 0;
      let cursor = "0";
      do {
        const [next, batch] = await redis.scan(cursor, "COUNT", 200);
        cursor = next;
        for (const key of batch) {
          const t = await redis.type(key);
          if (t === table) {
            deleted += await redis.del(key);
          }
        }
      } while (cursor !== "0");
      return deleted;
    });
  }

  async truncateTable(schema: string, table: string): Promise<QueryResult> {
    const start = performance.now();
    try {
      const n = await this.deleteKeysOfType(schema, table);
      return {
        columns: [],
        rows: [],
        rowCount: n,
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
    // Redis has no real tables — dropping a type group clears those keys
    return this.truncateTable(schema, table);
  }

  async dropSchema(schema: string, _cascade: boolean): Promise<QueryResult> {
    const start = performance.now();
    try {
      return await this.withDb(schema, async (redis) => {
        await redis.flushdb();
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          durationMs: Math.round(performance.now() - start),
        };
      });
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
    _schema: string,
    _table: string
  ): Promise<{ name: string; columns: string; isUnique: boolean; isPrimary: boolean }[]> {
    return [];
  }

  async getTableSize(
    _schema: string,
    _table: string
  ): Promise<{ totalSize: string; dataSize: string; indexSize: string }> {
    return { totalSize: "—", dataSize: "—", indexSize: "—" };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    let client: Redis | null = null;
    try {
      const db = this.dbIndex();
      if (this.config.connectionString?.trim()) {
        client = new Redis(this.config.connectionString.trim(), {
          db,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 5000,
          retryStrategy: () => null,
        });
      } else {
        client = new Redis({
          ...this.buildOptions(db),
          connectTimeout: 5000,
          retryStrategy: () => null,
        });
      }
      await client.connect();
      const pong = await client.ping();
      if (String(pong).toUpperCase() !== "PONG") {
        return { success: false, error: `Unexpected PING reply: ${pong}` };
      }
      return { success: true };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    } finally {
      if (client) {
        try {
          client.disconnect();
        } catch {
          // ignore
        }
      }
    }
  }
}
