import { useEffect } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { useUiStore } from "@/stores/uiStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainArea } from "@/components/layout/MainArea";
import { StatusBar } from "@/components/layout/StatusBar";
import { TitleBar } from "@/components/layout/TitleBar";
import { WelcomeScreen } from "@/components/layout/WelcomeScreen";
import { ConnectionFormModal } from "@/components/connections/ConnectionFormModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export default function App() {
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const resetSchema = useSchemaStore((s) => s.reset);
  const connectionFormOpen = useUiStore((s) => s.connectionFormOpen);
  const editingConnectionId = useUiStore((s) => s.editingConnectionId);
  const closeConnectionForm = useUiStore((s) => s.closeConnectionForm);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function apply(dark: boolean) {
      document.documentElement.classList.toggle("dark", dark);
    }
    apply(mq.matches);
    mq.addEventListener("change", (e) => apply(e.matches));
    return () => mq.removeEventListener("change", (e) => apply(e.matches));
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (!activeConnectionId) {
      resetSchema();
    }
  }, [activeConnectionId, resetSchema]);

  useKeyboardShortcuts();

  return (
    <div className="app-shell flex h-screen flex-col">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {activeConnectionId ? <MainArea /> : <WelcomeScreen />}
      </div>
      <StatusBar />
      {connectionFormOpen && (
        <ConnectionFormModal
          connectionId={editingConnectionId}
          onClose={closeConnectionForm}
        />
      )}
    </div>
  );
}
