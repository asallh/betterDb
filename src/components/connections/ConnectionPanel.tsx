import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useConnectionStore } from "@/stores/connectionStore";
import { useUiStore } from "@/stores/uiStore";
import { db } from "@/lib/ipc";
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
} from "lucide-react";

function ConnectionMenu({
  isActive,
  onConnect,
  onDisconnect,
  onDuplicate,
  onEdit,
  onDelete,
  onClose,
  anchorRef,
}: {
  isActive: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
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

  // Clamp so the menu stays in the viewport
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

export function ConnectionPanel() {
  const connections = useConnectionStore((s) => s.connections);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const saveConnection = useConnectionStore((s) => s.saveConnection);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const isConnecting = useConnectionStore((s) => s.isConnecting);
  const error = useConnectionStore((s) => s.error);
  const openConnectionForm = useUiStore((s) => s.openConnectionForm);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [confirmDeleteConn, setConfirmDeleteConn] =
    useState<{ id: string; name: string } | null>(null);

  const handleDuplicate = useCallback(
    async (id: string) => {
      const source = await db.getConnection(id);
      await saveConnection(buildDuplicatedConnection(source));
    },
    [saveConnection]
  );

  return (
    <div className="max-h-80 overflow-auto">
      {error && (
        <div className="mx-2 mt-2 rounded border border-destructive/50 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          {error}
        </div>
      )}

      <div className="p-1.5 space-y-0.5">
        {connections.map((conn) => {
          const isActive = conn.id === activeConnectionId;
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
                <span className="font-medium truncate">{conn.name}</span>
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
                  onConnect={() => connect(conn.id)}
                  onDisconnect={() => disconnect()}
                  onDuplicate={() => {
                    void handleDuplicate(conn.id);
                  }}
                  onEdit={() => openConnectionForm(conn.id)}
                  onDelete={() =>
                    setConfirmDeleteConn({ id: conn.id, name: conn.name })
                  }
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
    </div>
  );
}
