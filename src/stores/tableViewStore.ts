import { create } from "zustand";

interface TableViewStore {
  activeTable: { schema: string; table: string } | null;
  openTable: (schema: string, table: string) => void;
  closeTable: () => void;
}

export const useTableViewStore = create<TableViewStore>((set) => ({
  activeTable: null,
  openTable: (schema, table) => set({ activeTable: { schema, table } }),
  closeTable: () => set({ activeTable: null }),
}));
