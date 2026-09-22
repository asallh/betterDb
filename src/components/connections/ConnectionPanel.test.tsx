import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConnectionConfig } from "../../../shared/types";
import { ConnectionPanel } from "./ConnectionPanel";

const connections: ConnectionConfig[] = [
  {
    id: "conn-1",
    name: "Local Postgres",
    engine: "postgres",
    host: "localhost",
    port: 5432,
    database: "app",
    user: "postgres",
    password: "",
  },
  {
    id: "conn-2",
    name: "Staging",
    engine: "postgres",
    host: "db.example.com",
    port: 5432,
    database: "staging",
    user: "app",
    password: "",
  },
];

const connect = vi.fn<(id: string) => Promise<void>>(async () => undefined);
const disconnect = vi.fn<() => Promise<void>>(async () => undefined);
const deleteConnection = vi.fn<(id: string) => Promise<void>>(
  async () => undefined
);
const saveConnection = vi.fn<(config: ConnectionConfig) => Promise<void>>(
  async () => undefined
);
const openConnectionForm = vi.fn<(id: string | null) => void>();
const getConnection = vi.fn<(id: string) => Promise<ConnectionConfig>>(
  async (id) => {
    const found = connections.find((c) => c.id === id);
    if (!found) throw new Error("not found");
    return { ...found, password: "secret" };
  }
);

let activeConnectionId: string | null = null;

vi.mock("@/stores/connectionStore", () => ({
  useConnectionStore: (
    selector: (s: Record<string, unknown>) => unknown
  ) =>
    selector({
      connections,
      activeConnectionId,
      isConnecting: false,
      error: null,
      connect,
      disconnect,
      deleteConnection,
      saveConnection,
    }),
}));

vi.mock("@/stores/uiStore", () => ({
  useUiStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      openConnectionForm,
    }),
}));

vi.mock("@/lib/ipc", () => ({
  db: {
    getConnection: (id: string) => getConnection(id),
  },
}));

describe("ConnectionPanel options menu", () => {
  beforeEach(() => {
    activeConnectionId = null;
    connect.mockClear();
    disconnect.mockClear();
    deleteConnection.mockClear();
    saveConnection.mockClear();
    openConnectionForm.mockClear();
    getConnection.mockClear();
  });

  async function openMenuFor(name: string) {
    const user = userEvent.setup();
    render(<ConnectionPanel />);
    const options = screen.getByRole("button", {
      name: `Options for ${name}`,
    });
    // Make hover styles unnecessary — button is in DOM even at opacity 0
    await user.click(options);
    return { user, menu: screen.getByRole("menu") };
  }

  it("shows Connect, Duplicate, Edit, and Delete for an inactive connection", async () => {
    const { menu } = await openMenuFor("Local Postgres");
    expect(within(menu).getByRole("menuitem", { name: /connect/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /duplicate/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /edit/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /disconnect/i })
    ).not.toBeInTheDocument();
  });

  it("shows Disconnect when the connection is active", async () => {
    activeConnectionId = "conn-1";
    const { menu } = await openMenuFor("Local Postgres");
    expect(
      within(menu).getByRole("menuitem", { name: /disconnect/i })
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /^connect$/i })
    ).not.toBeInTheDocument();
  });

  it("calls connect from the menu", async () => {
    const { user, menu } = await openMenuFor("Local Postgres");
    await user.click(within(menu).getByRole("menuitem", { name: /connect/i }));
    expect(connect).toHaveBeenCalledWith("conn-1");
  });

  it("opens the edit form from the menu", async () => {
    const { user, menu } = await openMenuFor("Local Postgres");
    await user.click(within(menu).getByRole("menuitem", { name: /edit/i }));
    expect(openConnectionForm).toHaveBeenCalledWith("conn-1");
  });

  it("duplicates a connection with a new id and (copy) name", async () => {
    const { user, menu } = await openMenuFor("Local Postgres");
    await user.click(within(menu).getByRole("menuitem", { name: /duplicate/i }));
    expect(getConnection).toHaveBeenCalledWith("conn-1");
    expect(saveConnection).toHaveBeenCalledTimes(1);
    const saved = saveConnection.mock.calls[0][0];
    expect(saved.name).toBe("Local Postgres (copy)");
    expect(saved.id).not.toBe("conn-1");
    expect(saved.password).toBe("secret");
    expect(saved.host).toBe("localhost");
  });

  it("confirms delete then removes the connection", async () => {
    const { user, menu } = await openMenuFor("Staging");
    await user.click(within(menu).getByRole("menuitem", { name: /delete/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Staging");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    expect(deleteConnection).toHaveBeenCalledWith("conn-2");
  });

  it("portals the menu to document.body", async () => {
    await openMenuFor("Local Postgres");
    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toBe(document.body);
  });
});
