import { useEffect } from "react";
import { useQueryStore } from "@/stores/queryStore";
import { useTableViewStore } from "@/stores/tableViewStore";

export function useKeyboardShortcuts() {
  const addTab = useQueryStore((s) => s.addTab);
  const closeTab = useQueryStore((s) => s.closeTab);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const executeQuery = useQueryStore((s) => s.executeQuery);
  const tabs = useQueryStore((s) => s.tabs);
  const setActiveTab = useQueryStore((s) => s.setActiveTab);
  const tableTabs = useTableViewStore((s) => s.tableTabs);
  const activeTableId = useTableViewStore((s) => s.activeTableId);
  const closeTable = useTableViewStore((s) => s.closeTable);
  const setActiveTable = useTableViewStore((s) => s.setActiveTable);
  const clearTableFocus = useTableViewStore((s) => s.clearTableFocus);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "Enter") {
        e.preventDefault();
        if (activeTableId === null) {
          executeQuery(activeTabId);
        }
        return;
      }

      if (mod && e.key === "n") {
        e.preventDefault();
        clearTableFocus();
        addTab();
        return;
      }

      if (mod && e.key === "w") {
        e.preventDefault();
        if (activeTableId !== null) {
          closeTable(activeTableId);
        } else {
          closeTab(activeTabId);
        }
        return;
      }

      // Cmd+1-9 to switch across combined tab list (tables then queries)
      if (mod && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        if (index < tableTabs.length) {
          setActiveTable(tableTabs[index].id);
          return;
        }
        const queryIndex = index - tableTabs.length;
        if (queryIndex < tabs.length) {
          clearTableFocus();
          setActiveTab(tabs[queryIndex].id);
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    addTab,
    closeTab,
    activeTabId,
    executeQuery,
    tabs,
    setActiveTab,
    tableTabs,
    activeTableId,
    closeTable,
    setActiveTable,
    clearTableFocus,
  ]);
}
