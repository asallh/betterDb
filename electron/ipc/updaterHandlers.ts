import { ipcMain, shell } from "electron";
import { IPC } from "./channels";
import {
  getAppUpdateStatus,
  installDownloadedUpdate,
  releaseUrlForStatus,
} from "../updater/autoUpdate";

/** Updater IPC — always registered; never withholds DB handlers. */
export function registerUpdaterIpcHandlers(): void {
  ipcMain.handle(IPC.UPDATER_GET_STATUS, async () => getAppUpdateStatus());

  ipcMain.handle(IPC.UPDATER_INSTALL, async () => {
    installDownloadedUpdate();
  });

  ipcMain.handle(IPC.UPDATER_OPEN_RELEASE, async () => {
    const url = releaseUrlForStatus(getAppUpdateStatus());
    if (!url) {
      throw new Error("No release URL available");
    }
    await shell.openExternal(url);
  });
}
