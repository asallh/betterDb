import fs from "node:fs/promises";
import path from "node:path";
import { app, safeStorage } from "electron";
import type { ConnectionConfig } from "../../shared/types";

function getFilePath(): string {
  return path.join(app.getPath("userData"), "connections.json");
}

/** Encrypt a plaintext string using Electron's safeStorage (OS keychain). */
function encryptField(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) return value;
  return safeStorage.encryptString(value).toString("base64");
}

/** Decrypt a base64-encoded encrypted string. */
function decryptField(encoded: string): string {
  if (!safeStorage.isEncryptionAvailable()) return encoded;
  try {
    return safeStorage.decryptString(Buffer.from(encoded, "base64"));
  } catch {
    // If decryption fails (e.g. legacy plaintext data), return as-is
    return encoded;
  }
}

/** Shape stored on disk — password is encrypted. */
interface StoredConnection extends Omit<ConnectionConfig, "password"> {
  password: string; // encrypted base64
  _encrypted?: boolean; // flag to identify encrypted entries
}

function encryptConnection(conn: ConnectionConfig): StoredConnection {
  return {
    ...conn,
    password: encryptField(conn.password),
    _encrypted: safeStorage.isEncryptionAvailable(),
  };
}

function decryptConnection(stored: StoredConnection): ConnectionConfig {
  const { _encrypted, ...rest } = stored;
  return {
    ...rest,
    password: _encrypted ? decryptField(rest.password) : rest.password,
  };
}

export async function loadConnections(): Promise<ConnectionConfig[]> {
  try {
    const data = await fs.readFile(getFilePath(), "utf-8");
    const stored: StoredConnection[] = JSON.parse(data);
    return stored.map(decryptConnection);
  } catch {
    return [];
  }
}

export async function saveConnections(
  connections: ConnectionConfig[]
): Promise<void> {
  const filePath = getFilePath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const encrypted = connections.map(encryptConnection);
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(encrypted, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

export async function addOrUpdateConnection(
  config: ConnectionConfig
): Promise<void> {
  const connections = await loadConnections();
  const index = connections.findIndex((c) => c.id === config.id);
  if (index >= 0) {
    connections[index] = config;
  } else {
    connections.push(config);
  }
  await saveConnections(connections);
}

export async function deleteConnection(id: string): Promise<void> {
  const connections = await loadConnections();
  await saveConnections(connections.filter((c) => c.id !== id));
}
