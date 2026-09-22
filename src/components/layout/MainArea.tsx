import { useState } from "react";
import { useQueryStore } from "@/stores/queryStore";
import { tableTabLabel, useTableViewStore } from "@/stores/tableViewStore";
import { QueryEditor } from "@/components/query/QueryEditor";
import { QueryResults } from "@/components/query/QueryResults";
import { TableViewer } from "@/components/table/TableViewer";
import { QueryHistory } from "@/components/query/QueryHistory";
import { SavedQueries } from "@/components/query/SavedQueries";
import { WorkspaceTab } from "@/components/layout/WorkspaceTab";
import { Plus, Table2, Clock, Bookmark, FileCode2 } from "lucide-react";

type RightPanel = "history" | "saved" | null;

export function MainArea() {
  const tabs = useQueryStore((s) => s.tabs);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const setActiveTab = useQueryStore((s) => s.setActiveTab);
  const addTab = useQueryStore((s) => s.addTab);
  const closeTab = useQueryStore((s) => s.closeTab);
  const renameQueryTab = useQueryStore((s) => s.renameTab);
  const setQueryTabColor = useQueryStore((s) => s.setTabColor);
  const tableTabs = useTableViewStore((s) => s.tableTabs);
  const activeTableId = useTableViewStore((s) => s.activeTableId);
  const setActiveTable = useTableViewStore((s) => s.setActiveTable);
  const closeTable = useTableViewStore((s) => s.closeTable);
  const clearTableFocus = useTableViewStore((s) => s.clearTableFocus);
  const renameTableTab = useTableViewStore((s) => s.renameTab);
  const setTableTabColor = useTableViewStore((s) => s.setTabColor);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeTable = tableTabs.find((t) => t.id === activeTableId) ?? null;
  const showingTable = activeTable !== null;

  function togglePanel(panel: "history" | "saved") {
    setRightPanel((current) => (current === panel ? null : panel));
  }

  function focusQueryTab(id: string) {
    clearTableFocus();
    setActiveTab(id);
  }

  function createQueryTab() {
    clearTableFocus();
    addTab();
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="app-drag glass flex items-center border-b">
        <div className="flex flex-1 overflow-x-auto">
          {tableTabs.map((tableTab) => {
            const label = tableTabLabel(tableTab);
            return (
              <WorkspaceTab
                key={tableTab.id}
                label={label}
                color={tableTab.color}
                isActive={showingTable && tableTab.id === activeTableId}
                icon={<Table2 className="h-3 w-3 shrink-0 text-muted-foreground" />}
                onSelect={() => setActiveTable(tableTab.id)}
                onClose={() => closeTable(tableTab.id)}
                onRename={(title) => renameTableTab(tableTab.id, title)}
                onSetColor={(color) => setTableTabColor(tableTab.id, color)}
                closeLabel={`Close ${label}`}
                allowEmptyRename
              />
            );
          })}
          {tabs.map((tab) => (
            <WorkspaceTab
              key={tab.id}
              label={tab.title}
              color={tab.color}
              isActive={!showingTable && tab.id === activeTabId}
              icon={<FileCode2 className="h-3 w-3 shrink-0 text-muted-foreground" />}
              onSelect={() => focusQueryTab(tab.id)}
              onClose={() => closeTab(tab.id)}
              onRename={(title) => renameQueryTab(tab.id, title)}
              onSetColor={(color) => setQueryTabColor(tab.id, color)}
              closeLabel={`Close ${tab.title}`}
            />
          ))}
        </div>
        <div className="app-no-drag flex items-center shrink-0">
          <button
            type="button"
            onClick={createQueryTab}
            className="px-2 py-1.5 text-muted-foreground hover:text-foreground"
            title="New query tab"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-border mx-0.5" />
          <button
            type="button"
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
            type="button"
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
          <div className="w-72 border-l border-border/60 glass-panel shrink-0 overflow-hidden flex flex-col">
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
