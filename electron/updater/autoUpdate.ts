import { app, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import {
  UPDATER_STATUS_EVENT,
  githubReleaseUrl,
  updaterChannelForVersion,
  type AppUpdateStatus,
} from "../../shared/updateStatus";

export const GITHUB_REPO = "asallh/betterDb";

let currentStatus: AppUpdateStatus = {
  state: "idle",
  localVersion: "0.0.0",
};
let getMainWindow: () => BrowserWindow | null = () => null;
let configured = false;

function broadcast(status: AppUpdateStatus): void {
  currentStatus = status;
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(UPDATER_STATUS_EVENT, status);
  }
}

export function getAppUpdateStatus(): AppUpdateStatus {
  return currentStatus;
}

export function releaseUrlForStatus(status: AppUpdateStatus): string | null {
  if (
    status.state === "available" ||
    status.state === "downloading" ||
    status.state === "ready"
  ) {
    return githubReleaseUrl(GITHUB_REPO, status.remoteVersion);
  }
  return null;
}

/**
 * Configure electron-updater for packaged builds. No-op in Vite/dev serve.
 */
export function configureAutoUpdater(options: {
  getMainWindow: () => BrowserWindow | null;
}): void {
  getMainWindow = options.getMainWindow;
  const localVersion = app.getVersion();
  currentStatus = { state: "idle", localVersion };

  if (!app.isPackaged || configured) {
    return;
  }
  configured = true;

  const channel = updaterChannelForVersion(localVersion);
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = true;
  autoUpdater.channel = channel;

  autoUpdater.on("checking-for-update", () => {
    broadcast({ state: "checking", localVersion });
  });

  autoUpdater.on("update-available", (info) => {
    broadcast({
      state: "available",
      localVersion,
      remoteVersion: info.version,
    });
  });

  autoUpdater.on("update-not-available", () => {
    broadcast({ state: "idle", localVersion });
  });

  autoUpdater.on("download-progress", (progress) => {
    const remoteVersion =
      currentStatus.state === "available" ||
      currentStatus.state === "downloading" ||
      currentStatus.state === "ready"
        ? currentStatus.remoteVersion
        : "";
    broadcast({
      state: "downloading",
      localVersion,
      remoteVersion,
      percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    broadcast({
      state: "ready",
      localVersion,
      remoteVersion: info.version,
    });
  });

  autoUpdater.on("error", (err) => {
    broadcast({
      state: "error",
      localVersion,
      message: err instanceof Error ? err.message : "Update check failed",
    });
  });
}

/** Fire-and-forget check; fail-open (errors surface via status). */
export function startAutoUpdateCheck(): void {
  if (!app.isPackaged) {
    return;
  }
  void autoUpdater.checkForUpdates().catch((err: unknown) => {
    broadcast({
      state: "error",
      localVersion: app.getVersion(),
      message: err instanceof Error ? err.message : "Update check failed",
    });
  });
}

/** Apply a downloaded update (restarts the app). */
export function installDownloadedUpdate(): void {
  if (currentStatus.state !== "ready") {
    throw new Error("No update ready to install");
  }
  // isSilent=false, isForceRunAfter=true — relaunch after install.
  autoUpdater.quitAndInstall(false, true);
}
