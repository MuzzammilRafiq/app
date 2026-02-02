import { app, BrowserWindow, globalShortcut, Tray, Menu } from "electron";
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
let tray: Tray | null = null;
let isQuitting = false;

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

  // Handle window close - hide instead of close when tray is active (macOS)
  mainWindow.on("close", (event) => {
    if (process.platform === "darwin" && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  return mainWindow;
}

function createTray(): void {
  const iconPath = path.join(
    app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", ".."),
    "resources",
    "icons",
    "trayTemplate.png",
  );
  tray = new Tray(iconPath);
  tray.setToolTip("Open Desktop");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        createWindow();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    createWindow();
  });
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
  createTray();
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
