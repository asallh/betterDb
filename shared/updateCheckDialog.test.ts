import { describe, expect, it } from "vitest";
import { updateCheckDialogForStatus } from "./updateCheckDialog";

describe("updateCheckDialogForStatus", () => {
  it("explains unpackaged/dev builds", () => {
    const dialog = updateCheckDialogForStatus(
      { state: "idle", localVersion: "0.1.1" },
      "BetterDB",
      { isPackaged: false }
    );
    expect(dialog.title).toBe("Check for Updates");
    expect(dialog.message).toMatch(/development/i);
    expect(dialog.offerInstall).toBe(false);
  });

  it("reports up to date when idle", () => {
    const dialog = updateCheckDialogForStatus(
      { state: "idle", localVersion: "0.1.1-nightly.20260923.abc" },
      "BetterDB Nightly"
    );
    expect(dialog.title).toBe("You're up to date");
    expect(dialog.detail).toContain("0.1.1-nightly.20260923.abc");
    expect(dialog.offerInstall).toBe(false);
  });

  it("offers install when an update is ready", () => {
    const dialog = updateCheckDialogForStatus(
      {
        state: "ready",
        localVersion: "0.1.1-nightly.20260922.old",
        remoteVersion: "0.1.1-nightly.20260923.new",
      },
      "BetterDB Nightly"
    );
    expect(dialog.offerInstall).toBe(true);
    expect(dialog.message).toContain("0.1.1-nightly.20260923.new");
  });

  it("surfaces error detail", () => {
    const dialog = updateCheckDialogForStatus(
      {
        state: "error",
        localVersion: "0.1.1",
        message: "Cannot find channel nightly-mac.yml",
      },
      "BetterDB"
    );
    expect(dialog.type).toBe("warning");
    expect(dialog.detail).toContain("nightly-mac.yml");
  });
});
