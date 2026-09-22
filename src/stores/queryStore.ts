import { create } from "zustand";
import type { QueryResult } from "../../shared/types";
import { db } from "@/lib/ipc";
import { tabColorHex, type TabColorId } from "@/lib/tabColors";
import { useConnectionStore } from "./connectionStore";

export interface QueryTab {
  id: string;
  title: string;
  color: TabColorId | null;
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
  renameTab: (id: string, title: string) => void;
  setTabColor: (id: string, color: TabColorId | null) => void;
  updateSQL: (id: string, sql: string) => void;
  executeQuery: (id: string) => Promise<void>;
}

function createTab(index: number): QueryTab {
  return {
    id: crypto.randomUUID(),
    title: `Query ${index}`,
    color: null,
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
      const index = tabs.findIndex((t) => t.id === id);
      if (index === -1) return;

      // Never leave the workspace with zero query tabs
      if (tabs.length === 1) {
        const fresh = createTab(1);
        set({ tabs: [fresh], activeTabId: fresh.id });
        return;
      }

      const next = tabs.filter((t) => t.id !== id);
      let newActive = activeTabId;
      if (activeTabId === id) {
        // Prefer previous sibling, else next
        const neighborIndex = Math.max(0, index - 1);
        newActive = next[Math.min(neighborIndex, next.length - 1)].id;
      }
      set({ tabs: next, activeTabId: newActive });
    },

    setActiveTab: (id) => set({ activeTabId: id }),

    renameTab: (id, title) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, title: trimmed } : t)),
      }));
    },

    setTabColor: (id, color) => {
      if (color !== null && !tabColorHex(color)) return;
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, color } : t)),
      }));
    },

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
        const connectionId = useConnectionStore.getState().activeConnectionId;
        const result = await db.executeQuery(tab.sql, connectionId ?? undefined);
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
