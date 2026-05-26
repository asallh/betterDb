import { useState, useCallback, useRef, useEffect } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { SchemaTree } from "@/components/schema/SchemaTree";
import { ConnectionPanel } from "@/components/connections/ConnectionPanel";
import { DatabaseEngineIcon } from "@/components/icons/DatabaseIcons";
import {
  RefreshCw,
  LogOut,
  ChevronUp,
  ChevronDown,
  Plug,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 256;
const COLLAPSED_WIDTH = 44;

export function Sidebar() {
  const activeId = useConnectionStore((s) => s.activeConnectionId);
  const connections = useConnectionStore((s) => s.connections);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const refreshAll = useSchemaStore((s) => s.refreshAll);
  const [panelOpen, setPanelOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const active = connections.find((c) => c.id === activeId);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = width;

      function onMouseMove(e: MouseEvent) {
        const newWidth = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + (e.clientX - startX))
        );
        setWidth(newWidth);
      }

      function onMouseUp() {
        setIsResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [width]
  );

  // Disable text selection while resizing
  useEffect(() => {
    if (isResizing) {
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    } else {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing]);

  if (collapsed) {
    return (
      <div
        className="flex h-full flex-col border-r border-border bg-card"
        style={{ width: COLLAPSED_WIDTH }}
      >
        <div className="flex flex-col items-center py-2 gap-2">
          <button
            onClick={() => setCollapsed(false)}
            className="rounded p-1.5 hover:bg-accent text-muted-foreground"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>

        {active && (
          <div className="flex flex-col items-center gap-1.5 border-t border-border py-2">
            <DatabaseEngineIcon
              engine={active.engine}
              className="h-4 w-4 text-blue-500"
            />
            <span className="h-2 w-2 rounded-full bg-green-500" />
          </div>
        )}

        <div className="flex-1" />

        <div className="border-t border-border flex flex-col items-center py-2">
          <button
            onClick={() => {
              setCollapsed(false);
              setPanelOpen(true);
            }}
            className="rounded p-1.5 hover:bg-accent text-muted-foreground"
            title="Connections"
          >
            <DatabaseEngineIcon engine="postgres" className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className="relative flex h-full flex-col border-r border-border bg-card shrink-0"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight truncate">
          <span className="text-primary">BetterDB</span>
        </div>
        <div className="flex gap-0.5">
          {active && (
            <>
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
            </>
          )}
          <button
            onClick={() => setCollapsed(true)}
            className="rounded p-1 hover:bg-accent"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Active connection indicator */}
      {active && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <DatabaseEngineIcon
            engine={active.engine}
            className="h-4 w-4 text-blue-500 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{active.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {active.host}:{active.port}/{active.database}
            </div>
          </div>
          <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
        </div>
      )}

      {/* Schema tree */}
      <div className="flex-1 overflow-auto p-2">
        {activeId ? (
          <SchemaTree />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-foreground">
            <Plug className="h-8 w-8 mb-2" strokeWidth={1.5} />
            <span className="text-xs">No connection</span>
          </div>
        )}
      </div>

      {/* Bottom connection panel toggle */}
      <div className="border-t border-border">
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <div className="flex items-center gap-2">
            <DatabaseEngineIcon
              engine="postgres"
              className="h-3.5 w-3.5"
            />
            <span>Connections</span>
            {connections.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                {connections.length}
              </span>
            )}
          </div>
          {panelOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>

        {panelOpen && <ConnectionPanel />}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/30 ${
          isResizing ? "bg-primary/40" : ""
        }`}
      />
    </div>
  );
}
