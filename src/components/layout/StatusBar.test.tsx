import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusBar } from "./StatusBar";

vi.mock("@/stores/connectionStore", () => ({
  useConnectionStore: (
    selector: (s: {
      activeConnectionId: string | null;
      connections: unknown[];
    }) => unknown
  ) =>
    selector({
      activeConnectionId: null,
      connections: [],
    }),
}));

vi.mock("@/stores/queryStore", () => ({
  useQueryStore: (
    selector: (s: { activeTabId: string | null; tabs: unknown[] }) => unknown
  ) =>
    selector({
      activeTabId: null,
      tabs: [],
    }),
}));

const install = vi.fn<() => Promise<void>>(async () => undefined);
const openRelease = vi.fn<() => Promise<void>>(async () => undefined);
const check = vi.fn<() => Promise<unknown>>(async () => ({
  state: "idle",
  localVersion: "0.1.0",
}));

vi.mock("@/lib/updater", () => ({
  updater: {
    install: () => install(),
    openRelease: () => openRelease(),
    check: () => check(),
  },
}));

describe("StatusBar update indicator", () => {
  it("shows Update available when ready and installs on click", async () => {
    const user = userEvent.setup();
    render(
      <StatusBar
        updateStatus={{
          state: "ready",
          localVersion: "0.1.0",
          remoteVersion: "0.1.1",
        }}
      />
    );

    const button = screen.getByRole("button", { name: /update available/i });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("shows download progress", () => {
    render(
      <StatusBar
        updateStatus={{
          state: "downloading",
          localVersion: "0.1.0",
          remoteVersion: "0.1.1",
          percent: 42,
        }}
      />
    );
    expect(screen.getByText(/Downloading update… 42%/)).toBeInTheDocument();
  });

  it("retries update check when error indicator is clicked", async () => {
    const user = userEvent.setup();
    render(
      <StatusBar
        updateStatus={{
          state: "error",
          localVersion: "0.1.0",
          message: "network down",
        }}
      />
    );
    const button = screen.getByRole("button", { name: /update check failed/i });
    await user.click(button);
    expect(check).toHaveBeenCalledTimes(1);
  });
});
