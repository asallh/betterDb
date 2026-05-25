import { create } from "zustand";
import type { QueryResult } from "../../shared/types";
import { db } from "@/lib/ipc";

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  result: QueryResult | null;
  isExecuting: boolean;
}

interface QueryStore {
  tabs: QueryTab[];
  activeTabId: string;

  addTab: () => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateSQL: (id: string, sql: string) => void;
  executeQuery: (id: string) => Promise<void>;
}

function createTab(index: number): QueryTab {
  return {
    id: crypto.randomUUID(),
    title: `Query ${index}`,
    sql: "",
    result: null,
    isExecuting: false,
  };
}

export const useQueryStore = create<QueryStore>((set, get) => {
  const initial = createTab(1);
  return {
    tabs: [initial],
    activeTabId: initial.id,

    addTab: () => {
      const tab = createTab(get().tabs.length + 1);
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
    },

    closeTab: (id) => {
      const { tabs, activeTabId } = get();
      if (tabs.length <= 1) return;
      const next = tabs.filter((t) => t.id !== id);
      const newActive =
        activeTabId === id ? next[Math.max(0, next.length - 1)].id : activeTabId;
      set({ tabs: next, activeTabId: newActive });
    },

    setActiveTab: (id) => set({ activeTabId: id }),

    updateSQL: (id, sql) => {
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, sql } : t)),
      }));
    },

    executeQuery: async (id) => {
      const tab = get().tabs.find((t) => t.id === id);
      if (!tab || !tab.sql.trim()) return;

      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === id ? { ...t, isExecuting: true, result: null } : t
        ),
      }));

      try {
        const result = await db.executeQuery(tab.sql);
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === id ? { ...t, isExecuting: false, result } : t
          ),
        }));
      } catch (e) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === id
              ? {
                  ...t,
                  isExecuting: false,
                  result: {
                    columns: [],
                    rows: [],
                    rowCount: 0,
                    durationMs: 0,
                    error: e instanceof Error ? e.message : "Query failed",
                  },
                }
              : t
          ),
        }));
      }
    },
  };
});
