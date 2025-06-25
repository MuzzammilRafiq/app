// Import necessary Electron modules and other dependencies
import { app, BrowserWindow } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { isDev } from "./util.js";
import { setupGeminiHandlers, setupScreenshotHandlers } from "./ipcHandlers.js";

// Get current file path and directory (needed for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config();

// Global variable to track the main window
let mainWindow: BrowserWindow | null = null;

// Function to create the main window
function createWindow(): BrowserWindow {
  // If a window already exists, focus it and return
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    return mainWindow;
  }

  // Path to preload script (runs in renderer process with limited Node.js access)
  const preloadPath = path.join(__dirname, "preload.cjs");

  // Create the main application window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Disable Node.js in renderer for security
      contextIsolation: true, // Enable context isolation for security
      preload: preloadPath, // Preload script to expose safe APIs to renderer
    },
  });

  // Load appropriate content based on development/production mode
  if (isDev) {
    // Development: Load from Vite dev server
    mainWindow.loadURL("http://localhost:5173");
  } else {
    // Production: Load built HTML file
    mainWindow.loadFile(path.join(app.getAppPath(), "dist-renderer/index.html"));
  }

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed event
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

// Main application initialization
app.whenReady().then(() => {
  // Setup IPC handlers
  setupGeminiHandlers();
  setupScreenshotHandlers();

  // Create the main window
  createWindow();
});

// Handle macOS app activation (when dock icon is clicked)
app.on("activate", () => {
  // On macOS, re-create window when dock icon is clicked and no other windows open
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    // If window exists, focus it
    if (mainWindow) {
      mainWindow.focus();
    }
  }
});

// Prevent creating new windows when app is already running
app.on("second-instance", () => {
  // Someone tried to run a second instance, focus our window instead
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

// Quit when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
