import { ipcRenderer, contextBridge } from "electron";
import { IPC } from "./ipc/channels";
import { UPDATER_STATUS_EVENT } from "../shared/updateStatus";

// Only allow IPC calls to known channels
const ALLOWED_CHANNELS: Set<string> = new Set(Object.values(IPC));
const ALLOWED_EVENTS: Set<string> = new Set([UPDATER_STATUS_EVENT]);

function validateChannel(channel: string): void {
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`IPC channel not allowed: ${channel}`);
  }
}

function validateEvent(channel: string): void {
  if (!ALLOWED_EVENTS.has(channel)) {
    throw new Error(`IPC event not allowed: ${channel}`);
  }
}

contextBridge.exposeInMainWorld("ipcRenderer", {
  invoke(channel: string, ...args: unknown[]) {
    validateChannel(channel);
    return ipcRenderer.invoke(channel, ...args);
  },
  on(channel: string, listener: (...args: unknown[]) => void) {
    validateEvent(channel);
    const subscription = (
      _event: Electron.IpcRendererEvent,
      ...args: unknown[]
    ) => {
      listener(...args);
    };
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
});

contextBridge.exposeInMainWorld("env", {
  platform: process.platform,
});
