import { useEffect, useState } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { useUiStore } from "@/stores/uiStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainArea } from "@/components/layout/MainArea";
import { StatusBar } from "@/components/layout/StatusBar";
import { TitleBar } from "@/components/layout/TitleBar";
import { WelcomeScreen } from "@/components/layout/WelcomeScreen";
import { ForceUpdateScreen } from "@/components/layout/ForceUpdateScreen";
import { ConnectionFormModal } from "@/components/connections/ConnectionFormModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { updater } from "@/lib/updater";
import type { UpdateGateDecision } from "../shared/version";

export default function App() {
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const resetSchema = useSchemaStore((s) => s.reset);
  const connectionFormOpen = useUiStore((s) => s.connectionFormOpen);
  const editingConnectionId = useUiStore((s) => s.editingConnectionId);
  const closeConnectionForm = useUiStore((s) => s.closeConnectionForm);

  const [gate, setGate] = useState<UpdateGateDecision | null | undefined>(
    undefined
  );

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
    let cancelled = false;
    updater
      .getStatus()
      .then((status) => {
        if (!cancelled) setGate(status);
      })
      .catch(() => {
        if (!cancelled) setGate(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (gate?.kind === "force") return;
    if (gate === undefined) return;
    loadConnections();
  }, [gate, loadConnections]);

  useEffect(() => {
    if (!activeConnectionId) {
      resetSchema();
    }
  }, [activeConnectionId, resetSchema]);

  useKeyboardShortcuts();

  if (gate === undefined) {
    return (
      <div className="app-shell flex h-screen items-center justify-center text-sm text-muted-foreground">
        Checking for updates…
      </div>
    );
  }

  if (gate?.kind === "force") {
    return <ForceUpdateScreen decision={gate} />;
  }

  return (
    <div className="app-shell flex h-screen flex-col">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {activeConnectionId ? <MainArea /> : <WelcomeScreen />}
      </div>
      <StatusBar updateGate={gate} />
      {connectionFormOpen && (
        <ConnectionFormModal
          connectionId={editingConnectionId}
          onClose={closeConnectionForm}
        />
      )}
    </div>
  );
}
