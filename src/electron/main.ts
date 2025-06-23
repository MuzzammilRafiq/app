import { app, BrowserWindow } from "electron";
import path from "path";
import { isDev } from "./util.js";

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "dist-renderer/index.html"));
  }
});
