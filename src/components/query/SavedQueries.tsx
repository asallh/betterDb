import { useEffect, useState } from "react";
import { useHistoryStore } from "@/stores/historyStore";
import { useQueryStore } from "@/stores/queryStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { Bookmark, Trash2, Plus } from "lucide-react";

export function SavedQueries() {
  const savedQueries = useHistoryStore((s) => s.savedQueries);
  const loadSavedQueries = useHistoryStore((s) => s.loadSavedQueries);
  const saveQuery = useHistoryStore((s) => s.saveQuery);
  const deleteSavedQuery = useHistoryStore((s) => s.deleteSavedQuery);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const tabs = useQueryStore((s) => s.tabs);
  const updateSQL = useQueryStore((s) => s.updateSQL);
  const connectionId = useConnectionStore((s) => s.activeConnectionId);

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    loadSavedQueries();
  }, [loadSavedQueries]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  async function handleSave() {
    if (!name.trim() || !activeTab?.sql.trim()) return;
    await saveQuery(name.trim(), activeTab.sql, connectionId ?? undefined);
    setName("");
    setSaving(false);
  }

  function loadIntoEditor(sql: string) {
    updateSQL(activeTabId, sql);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
          Saved Queries
          <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
            {savedQueries.length}
          </span>
        </div>
        <button
          onClick={() => setSaving(!saving)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Save current query"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Save form */}
      {saving && (
        <div className="border-b border-border px-3 py-2 space-y-1.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Query name..."
            className="w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setSaving(false);
            }}
            autoFocus
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleSave}
              disabled={!name.trim() || !activeTab?.sql.trim()}
              className="rounded bg-primary px-2 py-0.5 text-[11px] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setSaving(false)}
              className="rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-auto">
        {savedQueries.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            No saved queries
          </div>
        ) : (
          savedQueries.map((q) => (
            <div
              key={q.id}
              className="flex items-start justify-between border-b border-border px-3 py-2 hover:bg-accent/50 transition-colors group"
            >
              <button
                onClick={() => loadIntoEditor(q.sql)}
                className="flex-1 text-left min-w-0"
              >
                <div className="text-xs font-medium truncate">{q.name}</div>
                <pre className="text-[10px] font-mono text-muted-foreground truncate mt-0.5 whitespace-pre overflow-hidden">
                  {q.sql.length > 80 ? q.sql.slice(0, 80) + "..." : q.sql}
                </pre>
              </button>
              <button
                onClick={() => deleteSavedQuery(q.id)}
                className="rounded p-0.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all shrink-0 mt-0.5"
                title="Delete saved query"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
