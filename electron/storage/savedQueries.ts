import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import type { SavedQuery } from "../../shared/types";

function getFilePath(): string {
  return path.join(app.getPath("userData"), "saved-queries.json");
}

export async function loadSavedQueries(): Promise<SavedQuery[]> {
  try {
    const data = await fs.readFile(getFilePath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function persist(queries: SavedQuery[]): Promise<void> {
  const filePath = getFilePath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(queries, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

export async function saveQuery(query: SavedQuery): Promise<void> {
  const queries = await loadSavedQueries();
  const index = queries.findIndex((q) => q.id === query.id);
  if (index >= 0) {
    queries[index] = query;
  } else {
    queries.unshift(query);
  }
  await persist(queries);
}

export async function deleteSavedQuery(id: string): Promise<void> {
  const queries = await loadSavedQueries();
  await persist(queries.filter((q) => q.id !== id));
}
