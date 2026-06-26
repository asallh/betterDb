import { useState } from "react";
import { useQueryStore } from "@/stores/queryStore";
import { useTableViewStore } from "@/stores/tableViewStore";
import { QueryEditor } from "@/components/query/QueryEditor";
import { QueryResults } from "@/components/query/QueryResults";
import { TableViewer } from "@/components/table/TableViewer";
import { QueryHistory } from "@/components/query/QueryHistory";
import { SavedQueries } from "@/components/query/SavedQueries";
import { Plus, X, Table2, Clock, Bookmark } from "lucide-react";

type RightPanel = "history" | "saved" | null;

export function MainArea() {
  const tabs = useQueryStore((s) => s.tabs);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const setActiveTab = useQueryStore((s) => s.setActiveTab);
  const addTab = useQueryStore((s) => s.addTab);
  const closeTab = useQueryStore((s) => s.closeTab);
  const activeTable = useTableViewStore((s) => s.activeTable);
  const closeTable = useTableViewStore((s) => s.closeTable);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const showingTable = activeTable !== null;

  function togglePanel(panel: "history" | "saved") {
    setRightPanel((current) => (current === panel ? null : panel));
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="app-drag flex items-center border-b border-border bg-card">
        <div className="flex flex-1 overflow-x-auto">
          {/* Table viewer tab (when active) */}
          {activeTable && (
            <div
              className={`app-no-drag group flex items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs font-medium transition-colors ${
                showingTable
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Table2 className="h-3 w-3 text-orange-500" />
              <span>
                {activeTable.schema}.{activeTable.table}
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  closeTable();
                }}
                className="rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </span>
            </div>
          )}
          {/* Query tabs */}
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                closeTable();
                setActiveTab(tab.id);
              }}
              className={`app-no-drag group flex items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs font-medium transition-colors ${
                !showingTable && tab.id === activeTabId
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <span>{tab.title}</span>
              {tabs.length > 1 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="app-no-drag flex items-center shrink-0">
          <button
            onClick={() => {
              closeTable();
              addTab();
            }}
            className="px-2 py-1.5 text-muted-foreground hover:text-foreground"
            title="New query tab"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-border mx-0.5" />
          <button
            onClick={() => togglePanel("history")}
            className={`px-2 py-1.5 transition-colors ${
              rightPanel === "history"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Query history"
          >
            <Clock className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => togglePanel("saved")}
            className={`px-2 py-1.5 transition-colors ${
              rightPanel === "saved"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Saved queries"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content area with optional right panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {showingTable ? (
            <TableViewer
              schema={activeTable.schema}
              table={activeTable.table}
            />
          ) : (
            activeTab && (
              <>
                <div className="h-[40%] min-h-[120px] border-b border-border">
                  <QueryEditor tabId={activeTab.id} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <QueryResults tab={activeTab} />
                </div>
              </>
            )
          )}
        </div>

        {/* Right panel */}
        {rightPanel && (
          <div className="w-72 border-l border-border bg-card shrink-0 overflow-hidden flex flex-col">
            {rightPanel === "history" ? (
              <QueryHistory />
            ) : (
              <SavedQueries />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
