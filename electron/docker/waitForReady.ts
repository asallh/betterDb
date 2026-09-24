import net from "node:net";
import pg from "pg";
import mysql from "mysql2/promise";
import Redis from "ioredis";
import { MongoClient } from "mongodb";
import type { DockerLocalEngine } from "../../shared/types";
import { isTransientStartupError } from "../../shared/docker/startupErrors";

export { isTransientStartupError };

export interface ReadyProbeOptions {
  engine: DockerLocalEngine;
  host?: string;
  port: number;
  user: string;
  password: string;
  database: string;
  attempts?: number;
  delayMs?: number;
}

async function waitForTcp(
  port: number,
  host: string,
  attempts: number,
  delayMs: number
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ port, host }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(
    `Database container started but did not accept connections on port ${port} in time.`
  );
}

async function probePostgres(opts: ReadyProbeOptions & { host: string }): Promise<void> {
  const client = new pg.Client({
    host: opts.host,
    port: opts.port,
    user: opts.user,
    password: opts.password,
    database: opts.database || "postgres",
    connectionTimeoutMillis: 3000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function probeMysql(opts: ReadyProbeOptions & { host: string }): Promise<void> {
  const conn = await mysql.createConnection({
    host: opts.host,
    port: opts.port,
    user: opts.user,
    password: opts.password,
    database: opts.database || undefined,
    connectTimeout: 3000,
  });
  try {
    await conn.query("SELECT 1");
  } finally {
    await conn.end().catch(() => undefined);
  }
}

async function probeRedis(opts: ReadyProbeOptions & { host: string }): Promise<void> {
  const client = new Redis({
    host: opts.host,
    port: opts.port,
    password: opts.password || undefined,
    connectTimeout: 3000,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });
  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== "PONG") throw new Error(`Unexpected Redis PING response: ${pong}`);
  } finally {
    client.disconnect();
  }
}

async function probeMongodb(opts: ReadyProbeOptions & { host: string }): Promise<void> {
  const user = encodeURIComponent(opts.user);
  const pass = encodeURIComponent(opts.password);
  const dbName = encodeURIComponent(opts.database || "admin");
  const uri = `mongodb://${user}:${pass}@${opts.host}:${opts.port}/${dbName}?authSource=admin`;
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 3000,
    connectTimeoutMS: 3000,
  });
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function probeOnce(opts: ReadyProbeOptions & { host: string }): Promise<void> {
  switch (opts.engine) {
    case "postgres":
      return probePostgres(opts);
    case "mysql":
      return probeMysql(opts);
    case "redis":
      return probeRedis(opts);
    case "mongodb":
      return probeMongodb(opts);
    default: {
      const _exhaustive: never = opts.engine;
      throw new Error(`Unsupported engine for readiness probe: ${_exhaustive}`);
    }
  }
}

/**
 * Wait until the engine accepts an authenticated query — not merely TCP.
 * Fixes "Connection terminated unexpectedly" when Postgres opens the port
 * before it finishes startup.
 */
export async function waitForDatabaseReady(
  opts: ReadyProbeOptions
): Promise<void> {
  const host = opts.host ?? "127.0.0.1";
  const attempts = opts.attempts ?? 90;
  const delayMs = opts.delayMs ?? 500;

  await waitForTcp(opts.port, host, attempts, delayMs);

  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await probeOnce({ ...opts, host });
      return;
    } catch (err) {
      lastError = err;
      // Keep retrying startup races; fail faster on clearly permanent errors
      // once the server has had a few chances to come up.
      if (i >= 8 && !isTransientStartupError(err)) {
        break;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Database container is running on port ${opts.port} but is not ready for queries yet: ${detail}`
  );
}
