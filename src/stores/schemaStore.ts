import { create } from "zustand";
import type { TableInfo, ColumnInfo } from "../../shared/types";
import { db } from "@/lib/ipc";

interface SchemaStore {
  schemas: string[];
  tables: TableInfo[];
  columns: Record<string, ColumnInfo[]>; // key: "schema.table"
  expandedNodes: Set<string>;
  isLoading: boolean;

  loadSchemas: () => Promise<void>;
  loadTables: (schema: string) => Promise<void>;
  loadColumns: (schema: string, table: string) => Promise<void>;
  toggleNode: (nodeId: string) => void;
  refreshAll: () => Promise<void>;
  reset: () => void;
}

export const useSchemaStore = create<SchemaStore>((set, get) => ({
  schemas: [],
  tables: [],
  columns: {},
  expandedNodes: new Set<string>(),
  isLoading: false,

  loadSchemas: async () => {
    set({ isLoading: true });
    try {
      const schemas = await db.getSchemas();
      set({ schemas });
    } finally {
      set({ isLoading: false });
    }
  },

  loadTables: async (schema: string) => {
    const tables = await db.getTables(schema);
    set((state) => ({
      tables: [
        ...state.tables.filter((t) => t.schema !== schema),
        ...tables,
      ],
    }));
  },

  loadColumns: async (schema: string, table: string) => {
    const columns = await db.getColumns(schema, table);
    set((state) => ({
      columns: { ...state.columns, [`${schema}.${table}`]: columns },
    }));
  },

  toggleNode: (nodeId: string) => {
    set((state) => {
      const next = new Set(state.expandedNodes);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return { expandedNodes: next };
    });
  },

  refreshAll: async () => {
    const { loadSchemas, loadTables, schemas } = get();
    await loadSchemas();
    for (const schema of schemas) {
      await loadTables(schema);
    }
  },

  reset: () => {
    set({
      schemas: [],
      tables: [],
      columns: {},
      expandedNodes: new Set(),
    });
  },
}));
