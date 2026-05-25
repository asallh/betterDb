import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import type { ConnectionConfig } from "../../shared/types";

function getFilePath(): string {
  return path.join(app.getPath("userData"), "connections.json");
}

export async function loadConnections(): Promise<ConnectionConfig[]> {
  try {
    const data = await fs.readFile(getFilePath(), "utf-8");
    return JSON.parse(data);
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
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(connections, null, 2), "utf-8");
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
