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
    <div className="app-drag glass flex items-center justify-between border-t px-3.5 py-1.5 text-[11px] tracking-[-0.01em] text-muted-foreground">
      <div className="flex items-center gap-3.5">
        {active ? (
          <>
            <span className="flex items-center gap-1.5 font-medium text-foreground/80">
              <DatabaseEngineIcon
                engine={active.engine}
                colored
                className="h-3.5 w-3.5"
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary"
                aria-hidden
              />
              {active.name}
            </span>
            <span className="tabular-nums text-muted-foreground/80">
              {active.host}:{active.port}/{active.database}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45"
              aria-hidden
            />
            Disconnected
          </span>
        )}
      </div>
      <div className="flex items-center gap-3.5 tabular-nums">
        {result && !result.error && (
          <>
            <span>{result.rowCount} rows</span>
            <span className="text-muted-foreground/70">{result.durationMs}ms</span>
          </>
        )}
        {result?.error && (
          <span className="text-destructive">Error</span>
        )}
      </div>
    </div>
  );
}
