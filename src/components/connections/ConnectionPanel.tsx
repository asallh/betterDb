import { useState, useRef, useEffect } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { ConnectionForm } from "./ConnectionForm";
import { DatabaseEngineIcon } from "@/components/icons/DatabaseIcons";
import {
  Plus,
  Trash2,
  Plug,
  PlugZap,
  Pencil,
  Loader2,
  MoreVertical,
} from "lucide-react";

function ConnectionMenu({
  onEdit,
  onDelete,
  onClose,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-md border border-border bg-popover p-1 shadow-md"
    >
      <button
        onClick={() => {
          onEdit();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent transition-colors"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
      <button
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
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        className="mx-4 w-full max-w-sm rounded-lg border border-border bg-popover p-4 shadow-lg"
      >
        <h3 className="text-sm font-semibold">Delete connection</h3>
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
    </div>
  );
}

function ConnectionFormModal({
  connectionId,
  onClose,
}: {
  connectionId: string | null;
  onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-popover p-5 shadow-lg">
        <h2 className="mb-4 text-sm font-semibold">
          {connectionId ? "Edit Connection" : "New Connection"}
        </h2>
        <ConnectionForm connectionId={connectionId} onClose={onClose} />
      </div>
    </div>
  );
}

export function ConnectionPanel() {
  const connections = useConnectionStore((s) => s.connections);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const isConnecting = useConnectionStore((s) => s.isConnecting);
  const error = useConnectionStore((s) => s.error);
  const [showForm, setShowForm] = useState(false);
  const [editingConnectionId, setEditingConnectionId] =
    useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteConn, setConfirmDeleteConn] =
    useState<{ id: string; name: string } | null>(null);

  return (
    <div className="max-h-80 overflow-auto border-t border-border">
      {error && (
        <div className="mx-2 mt-2 rounded border border-destructive/50 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          {error}
        </div>
      )}

      {/* Connection list */}
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
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0 mr-1" />
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
                  onClick={() =>
                    setMenuOpenId(menuOpenId === conn.id ? null : conn.id)
                  }
                  className="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground transition-all"
                  title="Options"
                >
                  <MoreVertical className="h-3 w-3" />
                </button>
              </div>

              {menuOpenId === conn.id && (
                <ConnectionMenu
                  onEdit={() => {
                    setEditingConnectionId(conn.id);
                    setShowForm(true);
                  }}
                  onDelete={() => setConfirmDeleteConn({ id: conn.id, name: conn.name })}
                  onClose={() => setMenuOpenId(null)}
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

      {/* New Connection button */}
      <div className="p-1.5 pt-0">
        <button
          onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-3 w-3" />
          New Connection
        </button>
      </div>

      {/* Connection form modal */}
      {(showForm || editingConnectionId) && (
        <ConnectionFormModal
          connectionId={editingConnectionId}
          onClose={() => {
            setShowForm(false);
            setEditingConnectionId(null);
          }}
        />
      )}

      {/* Confirm delete dialog */}
      {confirmDeleteConn && (
        <ConfirmDeleteDialog
          connName={confirmDeleteConn.name}
          onConfirm={() => {
            deleteConnection(confirmDeleteConn.id);
            setConfirmDeleteConn(null);
          }}
          onCancel={() => setConfirmDeleteConn(null)}
        />
      )}
    </div>
  );
}
