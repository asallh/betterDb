import { Menu, app, dialog, type MenuItemConstructorOptions } from "electron";
import {
  appDisplayNameForVersion,
  formatAboutDetail,
} from "../../shared/version";
import { updateCheckDialogForStatus } from "../../shared/updateCheckDialog";
import {
  checkForUpdatesNow,
  getAppUpdateStatus,
  installDownloadedUpdate,
} from "../updater/autoUpdate";

function showAboutDialog(): void {
  const version = app.getVersion();
  const name = appDisplayNameForVersion(version);
  void dialog.showMessageBox({
    type: "info",
    title: `About ${name}`,
    message: name,
    detail: formatAboutDetail(version),
    buttons: ["OK"],
  });
}

async function showCheckForUpdatesDialog(): Promise<void> {
  const version = app.getVersion();
  const name = appDisplayNameForVersion(version);
  const isPackaged = app.isPackaged;

  if (!isPackaged) {
    const copy = updateCheckDialogForStatus(
      { state: "idle", localVersion: version },
      name,
      { isPackaged: false }
    );
    await dialog.showMessageBox({
      type: copy.type,
      title: copy.title,
      message: copy.message,
      detail: copy.detail,
      buttons: ["OK"],
    });
    return;
  }

  // If an update is already downloaded, offer install without re-checking first.
  const existing = getAppUpdateStatus();
  if (existing.state === "ready") {
    const copy = updateCheckDialogForStatus(existing, name);
    const { response } = await dialog.showMessageBox({
      type: copy.type,
      title: copy.title,
      message: copy.message,
      detail: copy.detail,
      buttons: ["Restart and Install", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      try {
        installDownloadedUpdate();
      } catch {
        // fail-open: dialog already shown
      }
    }
    return;
  }

  const status = await checkForUpdatesNow();
  const copy = updateCheckDialogForStatus(status, name);

  if (copy.offerInstall) {
    const { response } = await dialog.showMessageBox({
      type: copy.type,
      title: copy.title,
      message: copy.message,
      detail: copy.detail,
      buttons: ["Restart and Install", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      try {
        installDownloadedUpdate();
      } catch {
        // fail-open
      }
    }
    return;
  }

  await dialog.showMessageBox({
    type: copy.type,
    title: copy.title,
    message: copy.message,
    detail: copy.detail,
    buttons: ["OK"],
  });
}

/** Application menu with About + Check for Updates. */
export function installAppMenu(): void {
  const version = app.getVersion();
  const name = appDisplayNameForVersion(version);
  const isMac = process.platform === "darwin";
  const aboutItem: MenuItemConstructorOptions = {
    label: `About ${name}`,
    click: showAboutDialog,
  };
  const checkUpdatesItem: MenuItemConstructorOptions = {
    label: "Check for Updates…",
    click: () => {
      void showCheckForUpdatesDialog();
    },
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: name,
            submenu: [
              aboutItem,
              checkUpdatesItem,
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        aboutItem,
        checkUpdatesItem,
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(isMac
          ? [
              { role: "pasteAndMatchStyle" as const },
              { role: "delete" as const },
              { role: "selectAll" as const },
            ]
          : [
              { role: "delete" as const },
              { type: "separator" as const },
              { role: "selectAll" as const },
            ]),
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [{ type: "separator" as const }, { role: "front" as const }]
          : [{ role: "close" as const }]),
      ],
    },
    {
      label: "Help",
      submenu: [checkUpdatesItem, { type: "separator" }, aboutItem],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
