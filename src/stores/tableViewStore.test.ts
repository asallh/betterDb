import { beforeEach, describe, expect, it } from "vitest";
import { tableTabLabel, useTableViewStore } from "./tableViewStore";

function resetStore() {
  useTableViewStore.setState({ tableTabs: [], activeTableId: null });
}

describe("tableViewStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("openTable stacks distinct tables and focuses the newest", () => {
    const { openTable } = useTableViewStore.getState();
    openTable("public", "users");
    openTable("public", "orders");

    const { tableTabs, activeTableId } = useTableViewStore.getState();
    expect(tableTabs).toHaveLength(2);
    expect(tableTabs[0]).toMatchObject({ schema: "public", table: "users" });
    expect(tableTabs[1]).toMatchObject({ schema: "public", table: "orders" });
    expect(activeTableId).toBe(tableTabs[1].id);
  });

  it("openTable focuses an existing tab instead of duplicating", () => {
    const { openTable } = useTableViewStore.getState();
    openTable("public", "users");
    openTable("public", "orders");
    openTable("public", "users");

    const { tableTabs, activeTableId } = useTableViewStore.getState();
    expect(tableTabs).toHaveLength(2);
    expect(activeTableId).toBe(tableTabs[0].id);
  });

  it("clearTableFocus keeps tabs open", () => {
    const { openTable, clearTableFocus } = useTableViewStore.getState();
    openTable("public", "users");
    openTable("public", "orders");
    clearTableFocus();

    const { tableTabs, activeTableId } = useTableViewStore.getState();
    expect(tableTabs).toHaveLength(2);
    expect(activeTableId).toBeNull();
  });

  it("closeTable removes a tab and focuses the previous sibling", () => {
    const { openTable, closeTable, setActiveTable } =
      useTableViewStore.getState();
    openTable("public", "users");
    openTable("public", "orders");
    openTable("public", "items");

    const midId = useTableViewStore.getState().tableTabs[1].id;
    setActiveTable(midId);
    closeTable(midId);

    const { tableTabs, activeTableId } = useTableViewStore.getState();
    expect(tableTabs.map((t) => t.table)).toEqual(["users", "items"]);
    expect(activeTableId).toBe(tableTabs[0].id);
  });

  it("closeTable clears focus when closing the last table tab", () => {
    const { openTable, closeTable } = useTableViewStore.getState();
    openTable("public", "users");
    const id = useTableViewStore.getState().tableTabs[0].id;
    closeTable(id);

    const { tableTabs, activeTableId } = useTableViewStore.getState();
    expect(tableTabs).toHaveLength(0);
    expect(activeTableId).toBeNull();
  });

  it("setActiveTable focuses an open table tab", () => {
    const { openTable, setActiveTable, clearTableFocus } =
      useTableViewStore.getState();
    openTable("public", "users");
    openTable("public", "orders");
    clearTableFocus();

    const firstId = useTableViewStore.getState().tableTabs[0].id;
    setActiveTable(firstId);
    expect(useTableViewStore.getState().activeTableId).toBe(firstId);
  });

  it("renameTab sets a custom title and clears it when blank", () => {
    useTableViewStore.getState().openTable("public", "users");
    const id = useTableViewStore.getState().tableTabs[0].id;

    useTableViewStore.getState().renameTab(id, " Users list ");
    expect(useTableViewStore.getState().tableTabs[0].title).toBe("Users list");

    useTableViewStore.getState().renameTab(id, "  ");
    expect(useTableViewStore.getState().tableTabs[0].title).toBeNull();
  });

  it("setTabColor assigns and clears a preset color", () => {
    useTableViewStore.getState().openTable("public", "users");
    const id = useTableViewStore.getState().tableTabs[0].id;

    useTableViewStore.getState().setTabColor(id, "sky");
    expect(useTableViewStore.getState().tableTabs[0].color).toBe("sky");

    useTableViewStore.getState().setTabColor(id, null);
    expect(useTableViewStore.getState().tableTabs[0].color).toBeNull();
  });

  it("tableTabLabel prefers custom title over schema.table", () => {
    useTableViewStore.getState().openTable("public", "users");
    const tab = useTableViewStore.getState().tableTabs[0];
    expect(tableTabLabel(tab)).toBe("public.users");
    expect(tableTabLabel({ ...tab, title: "People" })).toBe("People");
  });
});
