/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoke(channel: string, ...args: any[]): Promise<any>
    on(channel: string, listener: (...args: unknown[]) => void): () => void
  }
}

/**
 * Native optional engine SDKs — externalized in Vite and not installed in CI.
 * Runtime loads them when the corresponding engine is used.
 */
declare module "ibm_db" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ibmdb: any
  export default ibmdb
}

declare module "duckdb" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const duckdb: any
  export default duckdb
}
