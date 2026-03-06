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
import { LOG, truncateLines } from "./utils/logging.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const TAG = "electron:main";
const RENDERER_TAG = "renderer-console";

// Align Electron's renderer environment with the standalone WebGPU demo.
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-unsafe-webgpu");

let mainWindow: BrowserWindow | null = null;

function attachRendererConsoleBridge(window: BrowserWindow) {
  window.webContents.on("console-message", (details) => {
    const { level, message } = details;

    if (
      message.includes("Autofill.enable") ||
      message.includes("Autofill.setAddresses")
    ) {
      return;
    }

    const formattedMessage = `[${RENDERER_TAG}] ${truncateLines(message, 1800, 24)}`;

    switch (level) {
      case "warning":
        console.warn(formattedMessage);
        break;
      case "error":
        console.error(formattedMessage);
        break;
      case "debug":
        console.debug(formattedMessage);
        break;
      default:
        console.info(formattedMessage);
        break;
    }
  });
}

function registerDevelopmentDebugShortcuts() {
  const toggleDevTools = () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
      return;
    }

    mainWindow.webContents.openDevTools({ mode: "detach" });
  };

  globalShortcut.register("CommandOrControl+Alt+I", toggleDevTools);
  globalShortcut.register("F12", toggleDevTools);

  LOG(TAG).INFO(
    "Development logging enabled. Renderer console is mirrored to the terminal. Toggle DevTools with Cmd/Ctrl+Alt+I or F12.",
  );
}

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
      // The WebGPU transcription path needs normal browser isolation in dev.
      webSecurity: process.env.NODE_ENV === "development",
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    attachRendererConsoleBridge(mainWindow);
  } else {
    mainWindow.loadFile(
      path.join(app.getAppPath(), "dist-renderer/index.html"),
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Handle window close - hide instead of close when tray is active (macOS)
  mainWindow.on("close", (event) => {
    if (process.platform === "darwin") {
      event.preventDefault();
      mainWindow?.hide();
    }
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
  if (process.env.NODE_ENV === "development") {
    registerDevelopmentDebugShortcuts();
  }
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
