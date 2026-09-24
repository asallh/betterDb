import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetSchemaRefreshTimerForTests,
  useQueryStore,
} from "./queryStore";

const executeQuery = vi.fn();
const refreshAll = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/ipc", () => ({
  db: {
    executeQuery: (...args: unknown[]) => executeQuery(...args),
  },
}));

vi.mock("./connectionStore", () => ({
  useConnectionStore: {
    getState: () => ({ activeConnectionId: "conn-1" }),
  },
}));

vi.mock("./schemaStore", () => ({
  useSchemaStore: {
    getState: () => ({ refreshAll }),
  },
}));

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
    _resetSchemaRefreshTimerForTests();
    executeQuery.mockReset();
    refreshAll.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    _resetSchemaRefreshTimerForTests();
    vi.useRealTimers();
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

  describe("executeQuery schema refresh (#54)", () => {
    const okResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 1,
    };

    it("refreshes schema after a successful DDL query", async () => {
      executeQuery.mockResolvedValue(okResult);
      const id = useQueryStore.getState().activeTabId;
      useQueryStore.getState().updateSQL(id, "CREATE TABLE foo (id int)");

      await useQueryStore.getState().executeQuery(id);
      expect(refreshAll).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);
      expect(refreshAll).toHaveBeenCalledTimes(1);
    });

    it("does not refresh after a successful SELECT", async () => {
      executeQuery.mockResolvedValue(okResult);
      const id = useQueryStore.getState().activeTabId;
      useQueryStore.getState().updateSQL(id, "SELECT * FROM users");

      await useQueryStore.getState().executeQuery(id);
      await vi.advanceTimersByTimeAsync(300);
      expect(refreshAll).not.toHaveBeenCalled();
    });

    it("does not refresh when the result has an error", async () => {
      executeQuery.mockResolvedValue({ ...okResult, error: "syntax error" });
      const id = useQueryStore.getState().activeTabId;
      useQueryStore.getState().updateSQL(id, "CREATE TABLE foo (id int)");

      await useQueryStore.getState().executeQuery(id);
      await vi.advanceTimersByTimeAsync(300);
      expect(refreshAll).not.toHaveBeenCalled();
    });

    it("does not refresh when executeQuery throws", async () => {
      executeQuery.mockRejectedValue(new Error("connection lost"));
      const id = useQueryStore.getState().activeTabId;
      useQueryStore.getState().updateSQL(id, "DROP TABLE foo");

      await useQueryStore.getState().executeQuery(id);
      await vi.advanceTimersByTimeAsync(300);
      expect(refreshAll).not.toHaveBeenCalled();
      expect(useQueryStore.getState().tabs[0].result?.error).toBe(
        "connection lost"
      );
    });

    it("debounces rapid DDL executions into a single refresh", async () => {
      executeQuery.mockResolvedValue(okResult);
      const id = useQueryStore.getState().activeTabId;

      useQueryStore.getState().updateSQL(id, "CREATE TABLE a (id int)");
      await useQueryStore.getState().executeQuery(id);
      useQueryStore.getState().updateSQL(id, "CREATE TABLE b (id int)");
      await useQueryStore.getState().executeQuery(id);
      useQueryStore.getState().updateSQL(id, "CREATE INDEX idx ON a (id)");
      await useQueryStore.getState().executeQuery(id);

      expect(refreshAll).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(300);
      expect(refreshAll).toHaveBeenCalledTimes(1);
    });
  });
});
