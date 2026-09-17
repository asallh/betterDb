import type { AppUpdateStatus } from "../../shared/updateStatus";
import { UPDATER_STATUS_EVENT } from "../../shared/updateStatus";

export const updater = {
  getStatus: (): Promise<AppUpdateStatus> =>
    window.ipcRenderer.invoke("updater:getStatus"),
  install: (): Promise<void> => window.ipcRenderer.invoke("updater:install"),
  openRelease: (): Promise<void> =>
    window.ipcRenderer.invoke("updater:openRelease"),
  onStatus: (listener: (status: AppUpdateStatus) => void): (() => void) => {
    return window.ipcRenderer.on(UPDATER_STATUS_EVENT, (...args: unknown[]) => {
      listener(args[0] as AppUpdateStatus);
    });
  },
};
