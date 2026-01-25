import { app, BrowserWindow, globalShortcut } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { setupStreamHandlers } from "./ipc/stream.js";
import { setupImageEmbeddingHandlers } from "./ipc/imageEmbedding.js";
import { setupFileOperationHandlers } from "./ipc/fileOperations.js";
import { setupDatabaseHandlers } from "./ipc/database.js";
import { setupTextEmbeddingHandlers } from "./ipc/textEmbeddings.js";
import { setupWindowHandlers } from "./ipc/window.js";
import { setupAutomationHandlers } from "./ipc/automation.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    return mainWindow;
  }

  const preloadPath = path.join(__dirname, "..", "preload.cjs");

  mainWindow = new BrowserWindow({
    width: 1500,
    height: 1000,
    minWidth: 400,
    minHeight: 400,
    titleBarStyle: "hiddenInset", // Hide default title bar on macOS
    trafficLightPosition: { x: -100, y: -100 }, // Move native traffic lights off-screen
    webPreferences: {
      nodeIntegration: false, // Disable Node.js in renderer for security
      contextIsolation: true, // Enable context isolation for security
      preload: preloadPath, // Preload script to expose safe APIs to renderer
      webSecurity: false, // Allow loading local files for image display
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(
      path.join(app.getAppPath(), "dist-renderer/index.html"),
    );
  }

  // if (process.env.NODE_ENV === "development") {
  //   mainWindow.webContents.openDevTools();
  //   mainWindow.webContents.on(
  //     "console-message",
  //     (event, level, message, line, sourceId) => {
  //       if (
  //         message.includes("Autofill.enable") ||
  //         message.includes("Autofill.setAddresses")
  //       ) {
  //         return;
  //       }
  //     }
  //   );
  // }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

app.whenReady().then(() => {
  setupStreamHandlers();
  setupImageEmbeddingHandlers();
  setupTextEmbeddingHandlers();
  setupFileOperationHandlers();
  setupDatabaseHandlers();
  setupWindowHandlers();
  setupAutomationHandlers();
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    if (mainWindow) {
      mainWindow.focus();
    }
  }
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
