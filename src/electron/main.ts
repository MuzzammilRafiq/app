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

// Main application initialization
app.whenReady().then(() => {
  // Setup IPC handlers
  setupGeminiHandlers();
  setupScreenshotHandlers();

  // Path to preload script (runs in renderer process with limited Node.js access)
  const preloadPath = path.join(__dirname, "preload.cjs");

  // Create the main application window
  const mainWindow = new BrowserWindow({
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
});
