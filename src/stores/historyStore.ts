import { create } from "zustand";
import type { QueryHistoryEntry, SavedQuery } from "../../shared/types";
import { db } from "@/lib/ipc";

interface HistoryStore {
  history: QueryHistoryEntry[];
  savedQueries: SavedQuery[];
  isLoading: boolean;

  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;

  loadSavedQueries: () => Promise<void>;
  saveQuery: (name: string, sql: string, connectionId?: string) => Promise<void>;
  updateSavedQuery: (query: SavedQuery) => Promise<void>;
  deleteSavedQuery: (id: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: [],
  savedQueries: [],
  isLoading: false,

  loadHistory: async () => {
    set({ isLoading: true });
    try {
      const history = await db.getQueryHistory(200);
      set({ history });
    } finally {
      set({ isLoading: false });
    }
  },

  clearHistory: async () => {
    await db.clearQueryHistory();
    set({ history: [] });
  },

  loadSavedQueries: async () => {
    const savedQueries = await db.listSavedQueries();
    set({ savedQueries });
  },

  saveQuery: async (name, sql, connectionId) => {
    const query: SavedQuery = {
      id: crypto.randomUUID(),
      name,
      sql,
      connectionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveQuery(query);
    await get().loadSavedQueries();
  },

  updateSavedQuery: async (query) => {
    await db.saveQuery({ ...query, updatedAt: new Date().toISOString() });
    await get().loadSavedQueries();
  },

  deleteSavedQuery: async (id) => {
    await db.deleteSavedQuery(id);
    await get().loadSavedQueries();
  },
}));
