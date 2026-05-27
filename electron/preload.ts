import { ipcRenderer, contextBridge } from 'electron'
import { IPC } from './ipc/channels'

// Only allow IPC calls to known channels
const ALLOWED_CHANNELS: Set<string> = new Set(Object.values(IPC))

function validateChannel(channel: string): void {
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`IPC channel not allowed: ${channel}`)
  }
}

contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke(channel: string, ...args: unknown[]) {
    validateChannel(channel)
    return ipcRenderer.invoke(channel, ...args)
  },
})
