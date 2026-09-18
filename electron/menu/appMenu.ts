import { Menu, app, dialog, type MenuItemConstructorOptions } from "electron";
import {
  appDisplayNameForVersion,
  formatAboutDetail,
} from "../../shared/version";

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

/** Application menu with File → About so users can see Nightly vs Release. */
export function installAppMenu(): void {
  const version = app.getVersion();
  const name = appDisplayNameForVersion(version);
  const isMac = process.platform === "darwin";
  const aboutItem: MenuItemConstructorOptions = {
    label: `About ${name}`,
    click: showAboutDialog,
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: name,
            submenu: [
              aboutItem,
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
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
