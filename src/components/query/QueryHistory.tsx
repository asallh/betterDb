import { useEffect, useState } from "react";
import { useHistoryStore } from "@/stores/historyStore";
import { useQueryStore } from "@/stores/queryStore";
import {
  Clock,
  Search,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export function QueryHistory() {
  const history = useHistoryStore((s) => s.history);
  const loadHistory = useHistoryStore((s) => s.loadHistory);
  const clearHistory = useHistoryStore((s) => s.clearHistory);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const updateSQL = useQueryStore((s) => s.updateSQL);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filtered = search
    ? history.filter((e) =>
        e.sql.toLowerCase().includes(search.toLowerCase())
      )
    : history;

  function loadIntoEditor(sql: string) {
    updateSQL(activeTabId, sql);
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          History
          <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
            {filtered.length}
          </span>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
            title="Clear all history"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Search */}
      <div className="border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-1.5 rounded border border-input bg-background px-2 py-1">
          <Search className="h-3 w-3 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter history..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            {history.length === 0 ? "No query history yet" : "No matches"}
          </div>
        ) : (
          filtered.map((entry) => (
            <button
              key={entry.id}
              onClick={() => loadIntoEditor(entry.sql)}
              className="w-full text-left border-b border-border px-3 py-2 hover:bg-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <pre className="text-[11px] font-mono text-foreground truncate flex-1 whitespace-pre overflow-hidden">
                  {entry.sql.length > 120
                    ? entry.sql.slice(0, 120) + "..."
                    : entry.sql}
                </pre>
                {entry.error ? (
                  <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                <span>{formatTime(entry.executedAt)}</span>
                <span>{entry.durationMs}ms</span>
                {!entry.error && <span>{entry.rowCount} rows</span>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
