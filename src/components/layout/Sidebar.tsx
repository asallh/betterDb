import { useConnectionStore } from "@/stores/connectionStore";
import { SchemaTree } from "@/components/schema/SchemaTree";
import { Database, LogOut, RefreshCw } from "lucide-react";
import { useSchemaStore } from "@/stores/schemaStore";

export function Sidebar() {
  const activeId = useConnectionStore((s) => s.activeConnectionId);
  const connections = useConnectionStore((s) => s.connections);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const refreshAll = useSchemaStore((s) => s.refreshAll);

  const active = connections.find((c) => c.id === activeId);

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium truncate">
          <Database className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate">{active?.name ?? "BetterDB"}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => refreshAll()}
            className="rounded p-1 hover:bg-accent"
            title="Refresh schema"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={() => disconnect()}
            className="rounded p-1 hover:bg-accent"
            title="Disconnect"
          >
            <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <SchemaTree />
      </div>
    </div>
  );
}
