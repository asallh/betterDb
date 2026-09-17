/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_CHANNEL__: "dev" | "auto";

interface Window {
  env?: {
    platform: string;
  };
  ipcRenderer: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (...args: unknown[]) => void): () => void;
  };
}
