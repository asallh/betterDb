import type { AppUpdateStatus } from "./updateStatus";

export type UpdateCheckDialog = {
  type: "info" | "warning";
  title: string;
  message: string;
  detail: string;
  /** When true, offer Restart to install as the primary button. */
  offerInstall: boolean;
};

/** Copy for the Check for Updates menu dialog from soft updater status. */
export function updateCheckDialogForStatus(
  status: AppUpdateStatus,
  appName: string,
  options: { isPackaged: boolean } = { isPackaged: true }
): UpdateCheckDialog {
  if (!options.isPackaged) {
    return {
      type: "info",
      title: "Check for Updates",
      message: "Updates are unavailable in development",
      detail:
        "Packaged installs check GitHub Releases automatically and can update from this menu.",
      offerInstall: false,
    };
  }

  switch (status.state) {
    case "checking":
      return {
        type: "info",
        title: "Check for Updates",
        message: "Checking for updates…",
        detail: `Current version: ${status.localVersion}`,
        offerInstall: false,
      };
    case "available":
    case "downloading":
      return {
        type: "info",
        title: "Update available",
        message: `${appName} ${status.remoteVersion} is downloading.`,
        detail: `You are on ${status.localVersion}. The update will install when ready.`,
        offerInstall: false,
      };
    case "ready":
      return {
        type: "info",
        title: "Update ready",
        message: `${appName} ${status.remoteVersion} is ready to install.`,
        detail: `Restart to update from ${status.localVersion}.`,
        offerInstall: true,
      };
    case "error":
      return {
        type: "warning",
        title: "Update check failed",
        message: "Could not check for updates.",
        detail: status.message || "Unknown error",
        offerInstall: false,
      };
    case "idle":
    default:
      return {
        type: "info",
        title: "You're up to date",
        message: `${appName} is up to date.`,
        detail: `Version ${status.localVersion}`,
        offerInstall: false,
      };
  }
}
