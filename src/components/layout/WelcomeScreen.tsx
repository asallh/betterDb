import { Database, Plus } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";

export function WelcomeScreen() {
  const openConnectionsPanel = useUiStore((s) => s.openConnectionsPanel);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6">
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="glass-strong rounded-2xl border px-8 py-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-background/50 shadow-sm">
            <Database className="h-7 w-7 text-foreground" strokeWidth={1.5} />
          </div>
          <h2 className="mt-6 text-xl font-semibold tracking-tight text-foreground text-balance">
            Connect a database
          </h2>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            Browse schemas, run queries, and edit rows — start with a connection.
          </p>
          <button
            type="button"
            onClick={openConnectionsPanel}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-[filter,transform] hover:brightness-95 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add connection
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            Or open Connections in the sidebar
          </p>
        </div>
      </div>
    </div>
  );
}
