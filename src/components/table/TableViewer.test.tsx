import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TableViewer } from "./TableViewer";

const getTableData = vi.fn();
const getTableRowCount = vi.fn();
const getPrimaryKeys = vi.fn();
const getColumns = vi.fn();
const deleteRow = vi.fn();
const exportData = vi.fn();

vi.mock("@/lib/ipc", () => ({
  db: {
    getTableData: (...args: unknown[]) => getTableData(...args),
    getTableRowCount: (...args: unknown[]) => getTableRowCount(...args),
    getPrimaryKeys: (...args: unknown[]) => getPrimaryKeys(...args),
    getColumns: (...args: unknown[]) => getColumns(...args),
    deleteRow: (...args: unknown[]) => deleteRow(...args),
    exportData: (...args: unknown[]) => exportData(...args),
    updateCell: vi.fn(),
    insertRow: vi.fn(),
  },
}));

const okData = {
  columns: ["id", "name"],
  rows: [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ],
  rowCount: 2,
  durationMs: 1,
};

/** Give the virtualizer a non-zero scroll viewport in jsdom. */
function stubScrollMetrics() {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => 600,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 600,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => 800,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 800,
  });
}

describe("TableViewer safe delete", () => {
  beforeEach(() => {
    stubScrollMetrics();
    getTableData.mockResolvedValue(okData);
    getTableRowCount.mockResolvedValue(2);
    getPrimaryKeys.mockResolvedValue(["id"]);
    getColumns.mockResolvedValue([
      { name: "id", dataType: "integer", nullable: false },
      { name: "name", dataType: "text", nullable: true },
    ]);
    deleteRow.mockResolvedValue({
      columns: [],
      rows: [],
      rowCount: 1,
      durationMs: 1,
    });
  });

  it("shows checkboxes instead of a trash button when the table has a PK", async () => {
    render(<TableViewer schema="public" table="users" />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Select all rows on this page")
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Select row 1")).toBeInTheDocument();
    });

    expect(screen.queryByTitle("Delete row")).not.toBeInTheDocument();
  });

  it("requires confirm before deleting selected rows", async () => {
    const user = userEvent.setup();
    render(<TableViewer schema="public" table="users" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Select row 1")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Select row 1"));
    await user.click(screen.getByRole("button", { name: /Delete 1 selected/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete rows")).toBeInTheDocument();
    expect(deleteRow).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Delete row" }));

    await waitFor(() => {
      expect(deleteRow).toHaveBeenCalledWith({
        schema: "public",
        table: "users",
        primaryKeys: { id: 1 },
      });
    });
  });

  it("hides selection UI when there is no primary key", async () => {
    getPrimaryKeys.mockResolvedValue([]);
    render(<TableViewer schema="public" table="users" />);

    await waitFor(() => {
      expect(screen.getByText(/no primary key/i)).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Select row 1")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Select all rows on this page")
    ).not.toBeInTheDocument();
  });
});
