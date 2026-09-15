import { useConnectionStore } from "@/stores/connectionStore";
import { useQueryStore } from "@/stores/queryStore";
import { DatabaseEngineIcon } from "@/components/icons/DatabaseIcons";

export function StatusBar() {
  const activeId = useConnectionStore((s) => s.activeConnectionId);
  const connections = useConnectionStore((s) => s.connections);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const tabs = useQueryStore((s) => s.tabs);

  const active = connections.find((c) => c.id === activeId);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const result = activeTab?.result;

  return (
    <div className="app-drag flex items-center justify-between border-t border-border bg-card px-3 py-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        {active ? (
          <>
            <span className="flex items-center gap-1.5">
              <DatabaseEngineIcon
                engine={active.engine}
                colored
                className="h-3.5 w-3.5"
              />
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {active.name}
            </span>
            <span>
              {active.host}:{active.port}/{active.database}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span
              className="relative flex h-1.5 w-1.5"
              aria-hidden
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-muted-foreground/40 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
            </span>
            Disconnected
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {result && !result.error && (
          <>
            <span>{result.rowCount} rows</span>
            <span>{result.durationMs}ms</span>
          </>
        )}
        {result?.error && (
          <span className="text-destructive">Error</span>
        )}
      </div>
    </div>
  );
}
