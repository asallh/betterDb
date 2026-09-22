import { Info } from "lucide-react";
import { useConnectionStore } from "@/stores/connectionStore";
import { useQueryStore } from "@/stores/queryStore";
import { DatabaseEngineIcon } from "@/components/icons/DatabaseIcons";
import { updater } from "@/lib/updater";
import type { AppUpdateStatus } from "../../../shared/updateStatus";

interface StatusBarProps {
  updateStatus?: AppUpdateStatus | null;
}

export function StatusBar({ updateStatus }: StatusBarProps) {
  const activeId = useConnectionStore((s) => s.activeConnectionId);
  const connections = useConnectionStore((s) => s.connections);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const tabs = useQueryStore((s) => s.tabs);

  const active = connections.find((c) => c.id === activeId);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const result = activeTab?.result;

  async function onUpdateClick() {
    if (updateStatus?.state !== "ready") return;
    try {
      await updater.install();
    } catch {
      try {
        await updater.openRelease();
      } catch {
        // fail-open: leave the indicator visible
      }
    }
  }

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
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
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
        {updateStatus?.state === "downloading" && (
          <span className="app-no-drag flex items-center gap-1 text-muted-foreground/90">
            <Info className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
            Downloading update… {updateStatus.percent}%
          </span>
        )}
        {updateStatus?.state === "available" && (
          <span className="app-no-drag flex items-center gap-1 text-muted-foreground/90">
            <Info className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
            Downloading update…
          </span>
        )}
        {updateStatus?.state === "ready" && (
          <button
            type="button"
            onClick={() => void onUpdateClick()}
            className="app-no-drag inline-flex items-center gap-1 text-foreground/85 hover:text-foreground transition-colors"
            title={`Restart to install ${updateStatus.remoteVersion}`}
          >
            <Info className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
            Update available
          </button>
        )}
        {updateStatus?.state === "error" && (
          <span
            className="app-no-drag text-muted-foreground/80"
            title={updateStatus.message}
          >
            Update check failed
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
