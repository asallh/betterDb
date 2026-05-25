import { useEffect } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainArea } from "@/components/layout/MainArea";
import { StatusBar } from "@/components/layout/StatusBar";
import { ConnectionList } from "@/components/connections/ConnectionList";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export default function App() {
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const resetSchema = useSchemaStore((s) => s.reset);

  // Apply dark mode based on system preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function apply(dark: boolean) {
      document.documentElement.classList.toggle("dark", dark);
    }
    apply(mq.matches);
    mq.addEventListener("change", (e) => apply(e.matches));
    return () => mq.removeEventListener("change", (e) => apply(e.matches));
  }, []);

  // Reset schema when disconnected
  useEffect(() => {
    if (!activeConnectionId) {
      resetSchema();
    }
  }, [activeConnectionId, resetSchema]);

  useKeyboardShortcuts();

  if (!activeConnectionId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <ConnectionList />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainArea />
      </div>
      <StatusBar />
    </div>
  );
}
