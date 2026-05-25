import { useEffect } from "react";
import { useQueryStore } from "@/stores/queryStore";

export function useKeyboardShortcuts() {
  const addTab = useQueryStore((s) => s.addTab);
  const closeTab = useQueryStore((s) => s.closeTab);
  const activeTabId = useQueryStore((s) => s.activeTabId);
  const executeQuery = useQueryStore((s) => s.executeQuery);
  const tabs = useQueryStore((s) => s.tabs);
  const setActiveTab = useQueryStore((s) => s.setActiveTab);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "Enter") {
        e.preventDefault();
        executeQuery(activeTabId);
        return;
      }

      if (mod && e.key === "n") {
        e.preventDefault();
        addTab();
        return;
      }

      if (mod && e.key === "w") {
        e.preventDefault();
        closeTab(activeTabId);
        return;
      }

      // Cmd+1-9 to switch tabs
      if (mod && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        if (index < tabs.length) {
          setActiveTab(tabs[index].id);
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addTab, closeTab, activeTabId, executeQuery, tabs, setActiveTab]);
}
