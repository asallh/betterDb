import { useQueryStore } from "@/stores/queryStore";
import { useTableViewStore } from "@/stores/tableViewStore";
import { QueryEditor } from "@/components/query/QueryEditor";
import { QueryResults } from "@/components/query/QueryResults";
import { TableViewer } from "@/components/table/TableViewer";
import { Plus, X, Table2 } from "lucide-react";

export function MainArea() {
  const tabs = useQueryStore((s) => s.tabs);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const setActiveTab = useQueryStore((s) => s.setActiveTab);
  const addTab = useQueryStore((s) => s.addTab);
  const closeTab = useQueryStore((s) => s.closeTab);
  const activeTable = useTableViewStore((s) => s.activeTable);
  const closeTable = useTableViewStore((s) => s.closeTable);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const showingTable = activeTable !== null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-card">
        <div className="flex flex-1 overflow-x-auto">
          {/* Table viewer tab (when active) */}
          {activeTable && (
            <button
              onClick={() => {}} // already showing
              className={`group flex items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs font-medium transition-colors ${
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
            </button>
          )}
          {/* Query tabs */}
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                closeTable();
                setActiveTab(tab.id);
              }}
              className={`group flex items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs font-medium transition-colors ${
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
      </div>

      {/* Content area */}
      {showingTable ? (
        <TableViewer
          schema={activeTable.schema}
          table={activeTable.table}
        />
      ) : (
        activeTab && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="h-[40%] min-h-[120px] border-b border-border">
              <QueryEditor tabId={activeTab.id} />
            </div>
            <div className="flex-1 overflow-hidden">
              <QueryResults tab={activeTab} />
            </div>
          </div>
        )
      )}
    </div>
  );
}
