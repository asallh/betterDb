import { useEffect, useState } from "react";
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
import { applyStageTheme } from "@/lib/stageTheme";
import { updater } from "@/lib/updater";
import { resolveVersionInfo } from "../shared/version";
import type { AppUpdateStatus } from "../shared/updateStatus";

export default function App() {
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const resetSchema = useSchemaStore((s) => s.reset);
  const connectionFormOpen = useUiStore((s) => s.connectionFormOpen);
  const editingConnectionId = useUiStore((s) => s.editingConnectionId);
  const closeConnectionForm = useUiStore((s) => s.closeConnectionForm);

  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(
    null
  );

  useEffect(() => {
    const { stage } = resolveVersionInfo(__APP_VERSION__, __APP_CHANNEL__);
    applyStageTheme(stage);
  }, []);

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
        if (!cancelled) setUpdateStatus(status);
      })
      .catch(() => {
        if (!cancelled) setUpdateStatus(null);
      });
    const unsubscribe = updater.onStatus((status) => {
      if (!cancelled) setUpdateStatus(status);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
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
      <StatusBar updateStatus={updateStatus} />
      {connectionFormOpen && (
        <ConnectionFormModal
          connectionId={editingConnectionId}
          onClose={closeConnectionForm}
        />
      )}
    </div>
  );
}
