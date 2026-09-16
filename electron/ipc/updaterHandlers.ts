import { ipcMain, shell } from "electron";
import { IPC } from "./channels";
import type { UpdateGateDecision } from "../../shared/version";

let currentDecision: UpdateGateDecision | null = null;

export function setUpdateGateDecision(decision: UpdateGateDecision): void {
  currentDecision = decision;
}

export function getUpdateGateDecision(): UpdateGateDecision | null {
  return currentDecision;
}

/** Updater IPC only — safe to register even when DB handlers are withheld. */
export function registerUpdaterIpcHandlers(): void {
  ipcMain.handle(IPC.UPDATER_GET_STATUS, async () => currentDecision);

  ipcMain.handle(IPC.UPDATER_OPEN_RELEASE, async () => {
    const url = currentDecision?.kind === "force" || currentDecision?.kind === "ok"
      ? currentDecision.releaseUrl
      : null;
    if (!url) {
      throw new Error("No release URL available");
    }
    await shell.openExternal(url);
  });
}
