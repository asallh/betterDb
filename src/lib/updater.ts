import type { UpdateGateDecision } from "../../shared/version";

export const updater = {
  getStatus: (): Promise<UpdateGateDecision | null> =>
    window.ipcRenderer.invoke("updater:getStatus"),
  openRelease: (): Promise<void> =>
    window.ipcRenderer.invoke("updater:openRelease"),
};
