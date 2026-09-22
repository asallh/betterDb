import { beforeEach, describe, expect, it } from "vitest";
import { useQueryStore } from "./queryStore";

function resetStore() {
  const tab = {
    id: "tab-1",
    title: "Query 1",
    color: null,
    sql: "",
    result: null,
    isExecuting: false,
  };
  useQueryStore.setState({ tabs: [tab], activeTabId: tab.id });
}

describe("queryStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("addTab appends and activates a new query tab", () => {
    useQueryStore.getState().addTab();
    const { tabs, activeTabId } = useQueryStore.getState();
    expect(tabs).toHaveLength(2);
    expect(tabs[1].title).toBe("Query 2");
    expect(activeTabId).toBe(tabs[1].id);
  });

  it("closeTab on the last query resets to a fresh empty tab", () => {
    const { activeTabId: oldId } = useQueryStore.getState();
    useQueryStore.getState().updateSQL(oldId, "SELECT 1");
    useQueryStore.getState().closeTab(oldId);

    const { tabs, activeTabId } = useQueryStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).not.toBe(oldId);
    expect(tabs[0].sql).toBe("");
    expect(tabs[0].title).toBe("Query 1");
    expect(activeTabId).toBe(tabs[0].id);
  });

  it("closeTab on a middle tab activates the previous sibling", () => {
    useQueryStore.getState().addTab();
    useQueryStore.getState().addTab();
    const ids = useQueryStore.getState().tabs.map((t) => t.id);
    // Activate the middle tab, then close it
    useQueryStore.getState().setActiveTab(ids[1]);
    useQueryStore.getState().closeTab(ids[1]);

    const { tabs, activeTabId } = useQueryStore.getState();
    expect(tabs.map((t) => t.id)).toEqual([ids[0], ids[2]]);
    expect(activeTabId).toBe(ids[0]);
  });

  it("closeTab on a non-active tab leaves the active tab unchanged", () => {
    useQueryStore.getState().addTab();
    const [first, second] = useQueryStore.getState().tabs;
    useQueryStore.getState().setActiveTab(second.id);
    useQueryStore.getState().closeTab(first.id);

    const { tabs, activeTabId } = useQueryStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe(second.id);
    expect(activeTabId).toBe(second.id);
  });

  it("renameTab updates the title and ignores blank names", () => {
    const id = useQueryStore.getState().activeTabId;
    useQueryStore.getState().renameTab(id, "  Customers  ");
    expect(useQueryStore.getState().tabs[0].title).toBe("Customers");

    useQueryStore.getState().renameTab(id, "   ");
    expect(useQueryStore.getState().tabs[0].title).toBe("Customers");
  });

  it("setTabColor assigns and clears a preset color", () => {
    const id = useQueryStore.getState().activeTabId;
    useQueryStore.getState().setTabColor(id, "teal");
    expect(useQueryStore.getState().tabs[0].color).toBe("teal");

    useQueryStore.getState().setTabColor(id, null);
    expect(useQueryStore.getState().tabs[0].color).toBeNull();
  });
});
