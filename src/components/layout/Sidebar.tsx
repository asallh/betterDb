import { useState, useCallback, useRef, useEffect } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { useUiStore } from "@/stores/uiStore";
import { SchemaTree } from "@/components/schema/SchemaTree";
import { ConnectionPanel } from "@/components/connections/ConnectionPanel";
import { DatabaseEngineIcon, DatabaseCylinderIcon } from "@/components/icons/DatabaseIcons";
import {
  RefreshCw,
  LogOut,
  ChevronUp,
  Plug,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseVersion } from "../../../shared/version";

const versionInfo = parseVersion(__APP_VERSION__);

const STAGE_STYLES: Record<string, string> = {
  nightly: "bg-primary/12 border-primary/25 text-primary",
  alpha: "bg-primary/10 border-primary/20 text-primary",
  beta: "bg-primary/10 border-primary/25 text-primary",
  rc: "bg-primary/12 border-primary/25 text-primary",
  stable: "bg-primary/10 border-primary/20 text-primary",
};

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 256;
const COLLAPSED_WIDTH = 44;
const SNAP_THRESHOLD = 18;
/** Springy OEM ease — ease-out with a soft settle */
const EASE_SNAP = "cubic-bezier(0.32, 0.72, 0, 1)";
const SIDEBAR_MS = 340;
const PANEL_MS = 300;

export function Sidebar() {
  const activeId = useConnectionStore((s) => s.activeConnectionId);
  const connections = useConnectionStore((s) => s.connections);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const refreshAll = useSchemaStore((s) => s.refreshAll);
  const panelOpen = useUiStore((s) => s.connectionsPanelOpen);
  const setPanelOpen = useUiStore((s) => s.setConnectionsPanelOpen);
  const openConnectionsPanel = useUiStore((s) => s.openConnectionsPanel);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [contentVisible, setContentVisible] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const prevWidthRef = useRef(DEFAULT_WIDTH);
  const animTimers = useRef<number[]>([]);

  const active = connections.find((c) => c.id === activeId);

  const clearAnimTimers = useCallback(() => {
    animTimers.current.forEach((id) => window.clearTimeout(id));
    animTimers.current = [];
  }, []);

  useEffect(() => () => clearAnimTimers(), [clearAnimTimers]);

  const handleCollapse = useCallback(() => {
    clearAnimTimers();
    prevWidthRef.current = width;
    setIsAnimating(true);
    setCollapsed(true);
    // Fade content out early, unmount after the settle
    animTimers.current.push(
      window.setTimeout(() => setContentVisible(false), SIDEBAR_MS * 0.45),
      window.setTimeout(() => setIsAnimating(false), SIDEBAR_MS),
    );
  }, [width, clearAnimTimers]);

  const handleExpand = useCallback(() => {
    clearAnimTimers();
    setContentVisible(true);
    setIsAnimating(true);
    setCollapsed(false);
    setWidth(prevWidthRef.current);
    animTimers.current.push(
      window.setTimeout(() => setIsAnimating(false), SIDEBAR_MS),
    );
  }, [clearAnimTimers]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (collapsed) return;
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = width;

      function onMouseMove(e: MouseEvent) {
        const newWidth = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + (e.clientX - startX)),
        );
        setWidth(newWidth);
      }

      function onMouseUp(_e: MouseEvent) {
        setIsResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        // Soft snap back to the default rail width when close
        setWidth((current) => {
          if (Math.abs(current - DEFAULT_WIDTH) <= SNAP_THRESHOLD) {
            setIsAnimating(true);
            window.setTimeout(() => setIsAnimating(false), SIDEBAR_MS);
            return DEFAULT_WIDTH;
          }
          return current;
        });
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [width, collapsed],
  );

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

  // Expand rail when Connections is opened from elsewhere while collapsed
  const wasPanelOpen = useRef(panelOpen);
  useEffect(() => {
    const justOpened = panelOpen && !wasPanelOpen.current;
    wasPanelOpen.current = panelOpen;
    if (justOpened && collapsed) {
      handleExpand();
    }
  }, [panelOpen, collapsed, handleExpand]);

  const currentWidth = collapsed ? COLLAPSED_WIDTH : width;
  const sidebarWidthTransition =
    !isResizing && isAnimating
      ? `width ${SIDEBAR_MS}ms ${EASE_SNAP}`
      : undefined;

  return (
    <div
      ref={sidebarRef}
      className="glass-panel relative flex h-full flex-col border-r shrink-0 overflow-hidden"
      style={{
        width: currentWidth,
        transition: sidebarWidthTransition,
      }}
    >
      {/* Header */}
      <div className="app-drag flex items-center justify-between border-b border-border/60 px-2 py-2 shrink-0">
        {!collapsed ? (
          <>
            <div
              className={cn(
                "flex min-w-0 items-center gap-1 pl-1 text-sm font-semibold tracking-tight transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                isAnimating && !contentVisible
                  ? "pointer-events-none -translate-x-1 opacity-0"
                  : "translate-x-0 opacity-100",
              )}
            >
              <span className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.03em] text-foreground">
                BetterDB
              </span>
              {versionInfo.stage !== "stable" && (
                <span
                  className={`text-[11px] mx-3 shrink-0 inline-flex items-center border py-0.5 px-1.5 rounded-full leading-none ${STAGE_STYLES[versionInfo.stage]}`}
                >
                  {versionInfo.label}
                </span>
              )}
            </div>
            <div className="app-no-drag flex gap-0.5 shrink-0">
              {active && (
                <>
                  <button
                    onClick={() => refreshAll()}
                    className="icon-btn p-1.5"
                    title="Refresh schema"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => disconnect()}
                    className="icon-btn p-1.5"
                    title="Disconnect"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={handleCollapse}
                className="icon-btn p-1.5"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="app-no-drag flex w-full justify-center animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={handleExpand}
              className="icon-btn p-1.5"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Active connection indicator */}
      {active && (
        <div
          className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 shrink-0 transition-[justify-content] duration-300"
          style={{ justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <DatabaseEngineIcon
            engine={active.engine}
            colored
            className="h-4 w-4 shrink-0"
          />
          {contentVisible && (
            <div
              className={cn(
                "min-w-0 flex-1 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                collapsed
                  ? "pointer-events-none -translate-x-1 opacity-0"
                  : "translate-x-0 opacity-100",
              )}
            >
              <div className="text-xs font-medium truncate">{active.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {active.host}:{active.port}/{active.database}
              </div>
            </div>
          )}
          <span className="h-2 w-2 rounded-full bg-primary shrink-0 shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]" />
        </div>
      )}

      {/* Schema tree / No connection */}
      <div className="flex-1 overflow-auto p-2">
        {contentVisible ? (
          <div
            className={cn(
              "h-full transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
              collapsed
                ? "pointer-events-none translate-x-[-4px] opacity-0"
                : "translate-x-0 opacity-100",
            )}
          >
            {activeId ? (
              <SchemaTree />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-3 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40">
                  <Plug className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">No connection</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add one to browse schemas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openConnectionsPanel}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background/60 px-2.5 py-1.5 text-xs font-medium tracking-[-0.01em] text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.55)] transition-all duration-200 hover:bg-accent active:scale-[0.98]"
                >
                  <Plus className="h-3 w-3" />
                  Add connection
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center" />
        )}
      </div>

      {/* Bottom connection panel — animated height snap */}
      <div className="border-t border-border/60 shrink-0">
        {!collapsed ? (
          <>
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-colors"
            >
              <div className="flex items-center gap-2">
                <DatabaseCylinderIcon className="h-3.5 w-3.5" />
                <span>Connections</span>
                {connections.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                    {connections.length}
                  </span>
                )}
              </div>
              <ChevronUp
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  panelOpen && "rotate-180",
                )}
              />
            </button>
            <div
              className="grid transition-[grid-template-rows]"
              style={{
                gridTemplateRows: panelOpen ? "1fr" : "0fr",
                transitionTimingFunction: EASE_SNAP,
                transitionDuration: `${PANEL_MS}ms`,
              }}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  className={cn(
                    "transition-[opacity,transform]",
                    panelOpen
                      ? "translate-y-0 opacity-100"
                      : "translate-y-1 opacity-0 pointer-events-none",
                  )}
                  style={{
                    transitionTimingFunction: EASE_SNAP,
                    transitionDuration: `${PANEL_MS}ms`,
                  }}
                >
                  <ConnectionPanel />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex justify-center py-2">
            <button
              onClick={() => {
                handleExpand();
                openConnectionsPanel();
              }}
              className="rounded-md p-1.5 transition-colors hover:bg-accent text-muted-foreground"
              title="Connections"
            >
              <DatabaseCylinderIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Resize handle */}
      {!collapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors duration-150 hover:bg-foreground/20",
            isResizing && "bg-foreground/30",
          )}
        />
      )}
    </div>
  );
}
