import { create } from "zustand";

interface UiStore {
  connectionsPanelOpen: boolean;
  connectionFormOpen: boolean;
  editingConnectionId: string | null;
  setConnectionsPanelOpen: (open: boolean) => void;
  openConnectionsPanel: () => void;
  openConnectionForm: (connectionId?: string | null) => void;
  closeConnectionForm: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  connectionsPanelOpen: false,
  connectionFormOpen: false,
  editingConnectionId: null,
  setConnectionsPanelOpen: (open) => set({ connectionsPanelOpen: open }),
  openConnectionsPanel: () => set({ connectionsPanelOpen: true }),
  openConnectionForm: (connectionId = null) =>
    set({
      connectionFormOpen: true,
      editingConnectionId: connectionId,
      connectionsPanelOpen: true,
    }),
  closeConnectionForm: () =>
    set({ connectionFormOpen: false, editingConnectionId: null }),
}));
