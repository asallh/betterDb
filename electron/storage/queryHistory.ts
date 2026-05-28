import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import type { QueryHistoryEntry } from "../../shared/types";

const MAX_ENTRIES = 500;

function getFilePath(): string {
  return path.join(app.getPath("userData"), "query-history.json");
}

export async function loadHistory(limit = 100): Promise<QueryHistoryEntry[]> {
  try {
    const data = await fs.readFile(getFilePath(), "utf-8");
    const entries: QueryHistoryEntry[] = JSON.parse(data);
    return entries.slice(0, limit);
  } catch {
    return [];
  }
}

export async function addHistoryEntry(
  entry: QueryHistoryEntry
): Promise<void> {
  const entries = await loadHistory(MAX_ENTRIES);
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  const filePath = getFilePath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(entries), "utf-8");
  await fs.rename(tmpPath, filePath);
}

export async function clearHistory(): Promise<void> {
  try {
    await fs.unlink(getFilePath());
  } catch {
    // File may not exist
  }
}
