import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ConnectionManager } from "./db/ConnectionManager";
import { registerIpcHandlers } from "./ipc/handlers";
import { registerUpdaterIpcHandlers } from "./ipc/updaterHandlers";
import {
  configureAutoUpdater,
  startAutoUpdateCheck,
} from "./updater/autoUpdate";
import { appDisplayNameForVersion } from "../shared/version";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const connectionManager = new ConnectionManager();
const APP_DISPLAY_NAME = appDisplayNameForVersion(app.getVersion());

// Separate name → separate userData, so Nightly can run beside production.
if (APP_DISPLAY_NAME !== "BetterDB") {
  app.setName(APP_DISPLAY_NAME);
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  const isMac = process.platform === "darwin";
  const isDevServe = Boolean(VITE_DEV_SERVER_URL);
  const appRoot = process.env.APP_ROOT ?? path.join(__dirname, "..");
  const windowIcon = isDevServe
    ? path.join(appRoot, "build", "icons", "dev", "betterDB.png")
    : undefined;

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: APP_DISPLAY_NAME,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    ...(isMac ? { trafficLightPosition: { x: 12, y: 8 } } : {}),
    ...(windowIcon && !isMac ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  if (isMac && isDevServe && windowIcon) {
    app.dock?.setIcon(windowIcon);
  }

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  registerUpdaterIpcHandlers();
  registerIpcHandlers(connectionManager);

  configureAutoUpdater({ getMainWindow: () => win });
  createWindow();
  startAutoUpdateCheck();
});
