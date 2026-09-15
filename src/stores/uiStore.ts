import { create } from "zustand";

interface UiStore {
  connectionsPanelOpen: boolean;
  setConnectionsPanelOpen: (open: boolean) => void;
  openConnectionsPanel: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  connectionsPanelOpen: false,
  setConnectionsPanelOpen: (open) => set({ connectionsPanelOpen: open }),
  openConnectionsPanel: () => set({ connectionsPanelOpen: true }),
}));
