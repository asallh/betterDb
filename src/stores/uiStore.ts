import { create } from "zustand";

interface UiStore {
  connectionsPanelOpen: boolean;
  connectionFormOpen: boolean;
  editingConnectionId: string | null;
  dockerCreateOpen: boolean;
  setConnectionsPanelOpen: (open: boolean) => void;
  openConnectionsPanel: () => void;
  openConnectionForm: (connectionId?: string | null) => void;
  closeConnectionForm: () => void;
  openDockerCreate: () => void;
  closeDockerCreate: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  connectionsPanelOpen: false,
  connectionFormOpen: false,
  editingConnectionId: null,
  dockerCreateOpen: false,
  setConnectionsPanelOpen: (open) => set({ connectionsPanelOpen: open }),
  openConnectionsPanel: () => set({ connectionsPanelOpen: true }),
  openConnectionForm: (connectionId = null) =>
    set({
      connectionFormOpen: true,
      editingConnectionId: connectionId,
      connectionsPanelOpen: true,
      dockerCreateOpen: false,
    }),
  closeConnectionForm: () =>
    set({ connectionFormOpen: false, editingConnectionId: null }),
  openDockerCreate: () =>
    set({
      dockerCreateOpen: true,
      connectionFormOpen: false,
      editingConnectionId: null,
      connectionsPanelOpen: true,
    }),
  closeDockerCreate: () => set({ dockerCreateOpen: false }),
}));
