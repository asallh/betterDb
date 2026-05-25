import { create } from "zustand";
import type { ConnectionConfig } from "../../shared/types";
import { db } from "@/lib/ipc";

interface ConnectionStore {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  isConnecting: boolean;
  error: string | null;

  loadConnections: () => Promise<void>;
  saveConnection: (config: ConnectionConfig) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  connect: (id: string) => Promise<void>;
  disconnect: () => Promise<void>;
  testConnection: (
    config: ConnectionConfig
  ) => Promise<{ success: boolean; error?: string }>;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  isConnecting: false,
  error: null,

  loadConnections: async () => {
    const connections = await db.listConnections();
    set({ connections });
  },

  saveConnection: async (config) => {
    await db.saveConnection(config);
    await get().loadConnections();
  },

  deleteConnection: async (id) => {
    await db.deleteConnection(id);
    const { activeConnectionId } = get();
    if (activeConnectionId === id) {
      await get().disconnect();
    }
    await get().loadConnections();
  },

  connect: async (id) => {
    set({ isConnecting: true, error: null });
    try {
      await db.connect(id);
      set({ activeConnectionId: id, isConnecting: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Connection failed",
        isConnecting: false,
      });
    }
  },

  disconnect: async () => {
    await db.disconnect();
    set({ activeConnectionId: null });
  },

  testConnection: async (config) => {
    return db.testConnection(config);
  },
}));
