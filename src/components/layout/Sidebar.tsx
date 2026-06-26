import { useState, useCallback, useRef, useEffect } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { SchemaTree } from "@/components/schema/SchemaTree";
import { ConnectionPanel } from "@/components/connections/ConnectionPanel";
import { DatabaseEngineIcon, DatabaseCylinderIcon } from "@/components/icons/DatabaseIcons";
import {
  RefreshCw,
  LogOut,
  ChevronUp,
  ChevronDown,
  Plug,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { parseVersion } from "../../../shared/version";

const versionInfo = parseVersion(__APP_VERSION__);

const STAGE_STYLES: Record<string, string> = {
  nightly: "bg-purple-400/70 border-purple-500",
  alpha: "bg-orange-400/70 border-orange-500",
  beta: "bg-[#93D5FB]/70 border-[#3AA3E8]",
  rc: "bg-yellow-400/70 border-yellow-500",
  stable: "bg-green-400/70 border-green-500",
};

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 256;
const COLLAPSED_WIDTH = 44;
const TRANSITION_MS = 200;

export function Sidebar() {
  const activeId = useConnectionStore((s) => s.activeConnectionId);
  const connections = useConnectionStore((s) => s.connections);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const refreshAll = useSchemaStore((s) => s.refreshAll);
  const [panelOpen, setPanelOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const prevWidthRef = useRef(DEFAULT_WIDTH);

  const active = connections.find((c) => c.id === activeId);

  const handleCollapse = useCallback(() => {
    prevWidthRef.current = width;
    setIsAnimating(true);
    setCollapsed(true);
    setTimeout(() => setIsAnimating(false), TRANSITION_MS);
  }, [width]);

  const handleExpand = useCallback(() => {
    setIsAnimating(true);
    setCollapsed(false);
    setWidth(prevWidthRef.current);
    setTimeout(() => setIsAnimating(false), TRANSITION_MS);
  }, []);

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

      function onMouseUp() {
        setIsResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [width, collapsed],
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

  const currentWidth = collapsed ? COLLAPSED_WIDTH : width;
  const showContent = !collapsed;

  return (
    <div
      ref={sidebarRef}
      className="relative flex h-full flex-col border-r border-border bg-card shrink-0 overflow-hidden"
      style={{
        width: currentWidth,
        transition:
          isAnimating && !isResizing
            ? `width ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
            : undefined,
      }}
    >
      {/* Header */}
      <div className="app-drag flex items-center justify-between border-b border-border px-2 py-2 shrink-0">
        {showContent ? (
          <>
            <div
              className="flex items-center gap-2 text-sm font-semibold tracking-tight truncate pl-1"
              style={{
                opacity: isAnimating && collapsed ? 0 : 1,
                transition: isAnimating
                  ? `opacity ${TRANSITION_MS * 0.6}ms ease`
                  : undefined,
              }}
            >
              <div className="flex min-w-0 items-center gap-1 pl-1 text-sm font-semibold tracking-tight">
                <span className="min-w-0 truncate text-primary">BetterDB</span>
                {versionInfo.stage !== "stable" && (
                  <span
                    className={`text-secondary-foreground text-[10px] mx-3 shrink-0 inline-flex items-center border py-px px-1.5 rounded-full leading-none ${STAGE_STYLES[versionInfo.stage]}`}
                  >
                    {versionInfo.label}
                  </span>
                )}
              </div>
            </div>
            <div className="app-no-drag flex gap-0.5 shrink-0">
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
                onClick={handleCollapse}
                className="rounded p-1 hover:bg-accent"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </>
        ) : (
          <div className="app-no-drag flex w-full justify-center">
            <button
              onClick={handleExpand}
              className="rounded p-1.5 hover:bg-accent text-muted-foreground"
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
          className="flex items-center gap-2 border-b border-border px-3 py-1.5 shrink-0"
          style={{ justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <DatabaseEngineIcon
            engine={active.engine}
            colored
            className="h-4 w-4 shrink-0"
          />
          {showContent && (
            <div
              className="min-w-0 flex-1"
              style={{
                opacity: isAnimating && collapsed ? 0 : 1,
                transition: isAnimating
                  ? `opacity ${TRANSITION_MS * 0.6}ms ease`
                  : undefined,
              }}
            >
              <div className="text-xs font-medium truncate">{active.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {active.host}:{active.port}/{active.database}
              </div>
            </div>
          )}
          <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
        </div>
      )}

      {/* Schema tree / No connection */}
      <div className="flex-1 overflow-auto p-2">
        {showContent ? (
          <div
            style={{
              opacity: isAnimating && collapsed ? 0 : 1,
              transition: isAnimating
                ? `opacity ${TRANSITION_MS * 0.6}ms ease`
                : undefined,
            }}
          >
            {activeId ? (
              <SchemaTree />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-foreground">
                <Plug className="h-8 w-8 mb-2" strokeWidth={1.5} />
                <span className="text-xs">No connection</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center" />
        )}
      </div>

      {/* Bottom connection panel toggle */}
      <div className="border-t border-border shrink-0">
        {showContent ? (
          <>
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
              {panelOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
            {panelOpen && <ConnectionPanel />}
          </>
        ) : (
          <div className="flex justify-center py-2">
            <button
              onClick={() => {
                handleExpand();
                setPanelOpen(true);
              }}
              className="rounded p-1.5 hover:bg-accent text-muted-foreground"
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
          className={`absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/30 ${
            isResizing ? "bg-primary/40" : ""
          }`}
        />
      )}
    </div>
  );
}
