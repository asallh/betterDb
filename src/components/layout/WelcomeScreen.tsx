import { Database, Plus } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";

export function WelcomeScreen() {
  const openConnectionsPanel = useUiStore((s) => s.openConnectionsPanel);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,hsl(var(--primary)/0.10),transparent_55%),radial-gradient(ellipse_at_80%_85%,hsl(var(--ring)/0.06),transparent_50%)]"
      />
      <div className="relative max-w-md px-6 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <Database className="h-8 w-8 text-foreground" strokeWidth={1.5} />
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
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Add connection
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          Or open Connections in the sidebar
        </p>
      </div>
    </div>
  );
}
