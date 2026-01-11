import { ipcMain, BrowserWindow } from "electron";

export function setupWindowHandlers() {
  ipcMain.handle("window:minimize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });

  ipcMain.handle("window:maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });

  ipcMain.handle("window:toggle-fullscreen", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return false;
    }

    const shouldEnterFullscreen = !window.isFullScreen();
    window.setFullScreen(shouldEnterFullscreen);
    return shouldEnterFullscreen;
  });

  ipcMain.handle("window:is-fullscreen", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.isFullScreen() ?? false;
  });

  ipcMain.handle("window:close", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  ipcMain.handle("window:is-maximized", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.isMaximized() ?? false;
  });

  ipcMain.handle("window:get-platform", () => {
    return process.platform;
  });

  ipcMain.handle("window:hide", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.hide();
    return true;
  });

  ipcMain.handle("window:show", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.show();
    window?.focus();
    return true;
  });
}
