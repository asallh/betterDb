import { tabColorHex, type TabColorId } from "@/lib/tabColors";
import { create } from "zustand";

export interface TableTab {
  id: string;
  schema: string;
  table: string;
  /** Custom label; null/empty falls back to schema.table */
  title: string | null;
  color: TabColorId | null;
}

interface TableViewStore {
  tableTabs: TableTab[];
  /** null => query pane is focused; table tabs remain open */
  activeTableId: string | null;

  openTable: (schema: string, table: string) => void;
  closeTable: (id: string) => void;
  setActiveTable: (id: string) => void;
  clearTableFocus: () => void;
  renameTab: (id: string, title: string) => void;
  setTabColor: (id: string, color: TabColorId | null) => void;
}

export function tableTabLabel(tab: TableTab): string {
  const custom = tab.title?.trim();
  return custom || `${tab.schema}.${tab.table}`;
}

export const useTableViewStore = create<TableViewStore>((set, get) => ({
  tableTabs: [],
  activeTableId: null,

  openTable: (schema, table) => {
    const { tableTabs } = get();
    const existing = tableTabs.find(
      (t) => t.schema === schema && t.table === table
    );
    if (existing) {
      set({ activeTableId: existing.id });
      return;
    }
    const tab: TableTab = {
      id: crypto.randomUUID(),
      schema,
      table,
      title: null,
      color: null,
    };
    set({ tableTabs: [...tableTabs, tab], activeTableId: tab.id });
  },

  closeTable: (id) => {
    const { tableTabs, activeTableId } = get();
    const index = tableTabs.findIndex((t) => t.id === id);
    if (index === -1) return;

    const next = tableTabs.filter((t) => t.id !== id);
    let newActive: string | null = activeTableId;

    if (activeTableId === id) {
      if (next.length === 0) {
        newActive = null;
      } else {
        const neighborIndex = Math.max(0, index - 1);
        newActive = next[Math.min(neighborIndex, next.length - 1)].id;
      }
    }

    set({ tableTabs: next, activeTableId: newActive });
  },

  setActiveTable: (id) => {
    const exists = get().tableTabs.some((t) => t.id === id);
    if (exists) set({ activeTableId: id });
  },

  clearTableFocus: () => set({ activeTableId: null }),

  renameTab: (id, title) => {
    const trimmed = title.trim();
    set((s) => ({
      tableTabs: s.tableTabs.map((t) =>
        t.id === id ? { ...t, title: trimmed || null } : t
      ),
    }));
  },

  setTabColor: (id, color) => {
    // Validate against known palette (ignore unknown)
    if (color !== null && !tabColorHex(color)) return;
    set((s) => ({
      tableTabs: s.tableTabs.map((t) =>
        t.id === id ? { ...t, color } : t
      ),
    }));
  },
}));
