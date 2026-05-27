import { useEffect, useState } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { ConnectionForm } from "./ConnectionForm";
import { Database, Plus, Trash2, Plug } from "lucide-react";

export function ConnectionList() {
  const connections = useConnectionStore((s) => s.connections);
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const connect = useConnectionStore((s) => s.connect);
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const isConnecting = useConnectionStore((s) => s.isConnecting);
  const error = useConnectionStore((s) => s.error);
  const [showForm, setShowForm] = useState(false);
  const [editingConnectionId, setEditingConnectionId] =
    useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  return (
    <div className="w-full max-w-md space-y-6 p-8">
      <div className="text-center">
        <Database className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">BetterDB</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect to a PostgreSQL database
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {connections.length > 0 && (
        <div className="space-y-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent transition-colors"
            >
              <button
                className="flex flex-1 items-center gap-3 text-left"
                onClick={() => connect(conn.id)}
                disabled={isConnecting}
              >
                <Database className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {conn.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {conn.host}:{conn.port}/{conn.database}
                  </div>
                </div>
              </button>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => connect(conn.id)}
                  disabled={isConnecting}
                  className="rounded p-1.5 hover:bg-primary/10 text-primary"
                  title="Connect"
                >
                  <Plug className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setEditingConnectionId(conn.id);
                    setShowForm(true);
                  }}
                  className="rounded p-1.5 hover:bg-muted text-muted-foreground"
                  title="Edit"
                >
                  <Database className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteConnection(conn.id)}
                  className="rounded p-1.5 hover:bg-destructive/10 text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm || editingConnectionId ? (
        <ConnectionForm
          connectionId={editingConnectionId}
          onClose={() => {
            setShowForm(false);
            setEditingConnectionId(null);
          }}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Connection
        </button>
      )}

      {isConnecting && (
        <div className="text-center text-sm text-muted-foreground">
          Connecting...
        </div>
      )}
    </div>
  );
}
