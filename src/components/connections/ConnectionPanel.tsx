import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useConnectionStore } from "@/stores/connectionStore";
import { useUiStore } from "@/stores/uiStore";
import { db, docker } from "@/lib/ipc";
import type { DockerManagedContainer } from "../../../shared/types";
import { DatabaseEngineIcon } from "@/components/icons/DatabaseIcons";
import { buildDuplicatedConnection } from "./duplicateConnection";
import {
  Trash2,
  Plug,
  PlugZap,
  Pencil,
  Loader2,
  MoreVertical,
  Copy,
  Play,
  Square,
  Container,
} from "lucide-react";

function ConnectionMenu({
  isActive,
  isDockerManaged,
  dockerState,
  onConnect,
  onDisconnect,
  onDuplicate,
  onEdit,
  onDelete,
  onStartContainer,
  onStopContainer,
  onDestroyContainer,
  onClose,
  anchorRef,
}: {
  isActive: boolean;
  isDockerManaged: boolean;
  dockerState: DockerManagedContainer["state"] | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStartContainer: () => void;
  onStopContainer: () => void;
  onDestroyContainer: () => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right });
    }
  }, [anchorRef]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, anchorRef]);

  useEffect(() => {
    if (!menuRef.current || !pos) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.left < 8) {
      menuRef.current.style.left = "8px";
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
    if (rect.top < 8) {
      menuRef.current.style.top = "8px";
    }
  }, [pos]);

  if (!pos) return null;

  const itemClass =
    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent transition-colors";

  const showStart =
    isDockerManaged && dockerState !== null && dockerState !== "running";
  const showStop = isDockerManaged && dockerState === "running";

  const menu = (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[140px] rounded-md border glass-strong p-1"
      style={{ top: pos.top, left: pos.left, transform: "translateX(-100%)" }}
      role="menu"
    >
      {isActive ? (
        <button
          role="menuitem"
          onClick={() => {
            onDisconnect();
            onClose();
          }}
          className={itemClass}
        >
          <PlugZap className="h-3 w-3" />
          Disconnect
        </button>
      ) : (
        <button
          role="menuitem"
          onClick={() => {
            onConnect();
            onClose();
          }}
          className={itemClass}
        >
          <Plug className="h-3 w-3" />
          Connect
        </button>
      )}
      {showStart && (
        <button
          role="menuitem"
          onClick={() => {
            onStartContainer();
            onClose();
          }}
          className={itemClass}
        >
          <Play className="h-3 w-3" />
          Start container
        </button>
      )}
      {showStop && (
        <button
          role="menuitem"
          onClick={() => {
            onStopContainer();
            onClose();
          }}
          className={itemClass}
        >
          <Square className="h-3 w-3" />
          Stop container
        </button>
      )}
      <button
        role="menuitem"
        onClick={() => {
          onDuplicate();
          onClose();
        }}
        className={itemClass}
      >
        <Copy className="h-3 w-3" />
        Duplicate
      </button>
      <button
        role="menuitem"
        onClick={() => {
          onEdit();
          onClose();
        }}
        className={itemClass}
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
      {isDockerManaged && (
        <button
          role="menuitem"
          onClick={() => {
            onDestroyContainer();
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Container className="h-3 w-3" />
          Destroy container
        </button>
      )}
      <button
        role="menuitem"
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}

function ConfirmDeleteDialog({
  connName,
  onConfirm,
  onCancel,
}: {
  connName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node)
      ) {
        onCancel();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
      <div
        ref={dialogRef}
        className="mx-4 w-full max-w-sm rounded-2xl border border-border/80 bg-card p-5 shadow-[0_16px_48px_hsl(0_0%_0%/0.28)]"
        role="dialog"
        aria-labelledby="delete-connection-title"
      >
        <h3 id="delete-connection-title" className="text-sm font-semibold">
          Delete connection
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Are you sure you want to delete{" "}
          <span className="font-medium text-foreground">{connName}</span>?
          This action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ConfirmDestroyDialog({
  connName,
  containerName,
  onConfirm,
  onCancel,
}: {
  connName: string;
  containerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node)
      ) {
        onCancel();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
      <div
        ref={dialogRef}
        className="mx-4 w-full max-w-sm rounded-2xl border border-border/80 bg-card p-5 shadow-[0_16px_48px_hsl(0_0%_0%/0.28)]"
        role="dialog"
        aria-labelledby="destroy-container-title"
      >
        <h3 id="destroy-container-title" className="text-sm font-semibold">
          Destroy local database
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          This removes the Docker container{" "}
          <span className="font-mono text-foreground">{containerName}</span>,
          its data volume, and the saved connection{" "}
          <span className="font-medium text-foreground">{connName}</span>. This
          cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Destroy
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConnectionPanel() {
  const connections = useConnectionStore((s) => s.connections);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const saveConnection = useConnectionStore((s) => s.saveConnection);
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const isConnecting = useConnectionStore((s) => s.isConnecting);
  const error = useConnectionStore((s) => s.error);
  const openConnectionForm = useUiStore((s) => s.openConnectionForm);
  const openDockerCreate = useUiStore((s) => s.openDockerCreate);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [confirmDeleteConn, setConfirmDeleteConn] =
    useState<{ id: string; name: string } | null>(null);
  const [confirmDestroy, setConfirmDestroy] = useState<{
    id: string;
    name: string;
    containerName: string;
  } | null>(null);
  const [dockerByName, setDockerByName] = useState<
    Record<string, DockerManagedContainer>
  >({});
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshDocker = useCallback(async () => {
    try {
      // Use getState so this callback stays stable across renders.
      await useConnectionStore.getState().loadConnections();
      const list = await docker.list();
      const map: Record<string, DockerManagedContainer> = {};
      for (const c of list) map[c.containerName] = c;
      setDockerByName(map);
    } catch {
      // Docker may be unavailable; leave map empty
      setDockerByName({});
    }
  }, []);

  const connectionIds = connections.map((c) => c.id).join(",");

  useEffect(() => {
    void refreshDocker();
  }, [refreshDocker, connectionIds]);

  useEffect(() => {
    function onFocus() {
      void refreshDocker();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshDocker]);

  const handleDuplicate = useCallback(
    async (id: string) => {
      const source = await db.getConnection(id);
      await saveConnection(buildDuplicatedConnection(source));
    },
    [saveConnection]
  );

  const handleStart = useCallback(
    async (containerName: string) => {
      setActionError(null);
      try {
        await docker.start(containerName);
        await refreshDocker();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Failed to start container");
      }
    },
    [refreshDocker]
  );

  const handleStop = useCallback(
    async (containerName: string) => {
      setActionError(null);
      try {
        await docker.stop(containerName);
        await refreshDocker();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Failed to stop container");
      }
    },
    [refreshDocker]
  );

  const handleDestroy = useCallback(
    async (containerName: string, connectionId: string) => {
      setActionError(null);
      try {
        if (activeConnectionId === connectionId) {
          await disconnect();
        }
        await docker.destroy(containerName);
        await loadConnections();
        await refreshDocker();
      } catch (e) {
        setActionError(
          e instanceof Error ? e.message : "Failed to destroy container"
        );
      }
    },
    [activeConnectionId, disconnect, loadConnections, refreshDocker]
  );

  return (
    <div className="max-h-80 overflow-auto">
      {(error || actionError) && (
        <div className="mx-2 mt-2 rounded border border-destructive/50 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          {actionError ?? error}
        </div>
      )}

      <div className="flex items-center gap-1 px-2 pt-1.5">
        <button
          type="button"
          onClick={() => openConnectionForm()}
          className="flex-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          Add connection
        </button>
        <button
          type="button"
          onClick={() => openDockerCreate()}
          className="flex-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          New local DB
        </button>
      </div>

      <div className="p-1.5 space-y-0.5">
        {connections.map((conn) => {
          const isActive = conn.id === activeConnectionId;
          const isDocker = Boolean(conn.docker?.managed);
          const containerName = conn.docker?.containerName;
          const dockerInfo = containerName
            ? dockerByName[containerName]
            : undefined;
          return (
            <div
              key={conn.id}
              className={`group relative flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors ${
                isActive
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenuOpenId(menuOpenId === conn.id ? null : conn.id);
              }}
            >
              <DatabaseEngineIcon
                engine={conn.engine}
                colored={isActive}
                className={`h-4 w-4 shrink-0 ${
                  isActive ? "" : "text-muted-foreground/60"
                }`}
              />
              <div className="flex flex-1 flex-col min-w-0">
                <span className="font-medium truncate flex items-center gap-1.5">
                  {conn.name}
                  {isDocker && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-px text-[9px] font-medium text-muted-foreground"
                      title={
                        dockerInfo
                          ? `Docker: ${dockerInfo.state}`
                          : "Docker-managed"
                      }
                    >
                      <Container className="h-2.5 w-2.5" />
                      {dockerInfo?.state === "running"
                        ? "up"
                        : dockerInfo
                          ? dockerInfo.state
                          : "docker"}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {conn.host}:{conn.port}/{conn.database}
                </span>
              </div>
              <div className="flex gap-0.5 items-center">
                {isActive ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mr-1 shadow-[0_0_0_2px_rgb(16_185_129/0.2)]" />
                    <button
                      onClick={() => disconnect()}
                      className="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive transition-all"
                      title="Disconnect"
                    >
                      <PlugZap className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => connect(conn.id)}
                    disabled={isConnecting}
                    className="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-primary/10 text-primary transition-all"
                    title="Connect"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plug className="h-3 w-3" />
                    )}
                  </button>
                )}
                <button
                  ref={(el) => {
                    menuButtonRefs.current[conn.id] = el;
                  }}
                  onClick={() =>
                    setMenuOpenId(menuOpenId === conn.id ? null : conn.id)
                  }
                  className="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground transition-all"
                  title="Options"
                  aria-label={`Options for ${conn.name}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpenId === conn.id}
                >
                  <MoreVertical className="h-3 w-3" />
                </button>
              </div>

              {menuOpenId === conn.id && menuButtonRefs.current[conn.id] && (
                <ConnectionMenu
                  isActive={isActive}
                  isDockerManaged={isDocker}
                  dockerState={dockerInfo?.state ?? null}
                  onConnect={() => connect(conn.id)}
                  onDisconnect={() => disconnect()}
                  onDuplicate={() => {
                    void handleDuplicate(conn.id);
                  }}
                  onEdit={() => openConnectionForm(conn.id)}
                  onDelete={() =>
                    setConfirmDeleteConn({ id: conn.id, name: conn.name })
                  }
                  onStartContainer={() => {
                    if (containerName) void handleStart(containerName);
                  }}
                  onStopContainer={() => {
                    if (containerName) void handleStop(containerName);
                  }}
                  onDestroyContainer={() => {
                    if (containerName) {
                      setConfirmDestroy({
                        id: conn.id,
                        name: conn.name,
                        containerName,
                      });
                    }
                  }}
                  onClose={() => setMenuOpenId(null)}
                  anchorRef={{
                    current: menuButtonRefs.current[conn.id],
                  }}
                />
              )}
            </div>
          );
        })}

        {connections.length === 0 && (
          <div className="py-3 text-center text-[11px] text-muted-foreground/60">
            No saved connections
          </div>
        )}
      </div>

      {confirmDeleteConn && (
        <ConfirmDeleteDialog
          connName={confirmDeleteConn.name}
          onConfirm={() => {
            void deleteConnection(confirmDeleteConn.id);
            setConfirmDeleteConn(null);
          }}
          onCancel={() => setConfirmDeleteConn(null)}
        />
      )}

      {confirmDestroy && (
        <ConfirmDestroyDialog
          connName={confirmDestroy.name}
          containerName={confirmDestroy.containerName}
          onConfirm={() => {
            void handleDestroy(
              confirmDestroy.containerName,
              confirmDestroy.id
            );
            setConfirmDestroy(null);
          }}
          onCancel={() => setConfirmDestroy(null)}
        />
      )}
    </div>
  );
}
