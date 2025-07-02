// Import necessary Electron modules and other dependencies
import { app, BrowserWindow, globalShortcut } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { setupGeminiHandlers } from './ipc/gemini.js';
import { setupScreenshotHandlers } from './ipc/screenshot.js';

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
  const preloadPath = path.join(__dirname, 'preload.cjs');

  // Create the main application window
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 1000,
    webPreferences: {
      nodeIntegration: false, // Disable Node.js in renderer for security
      contextIsolation: true, // Enable context isolation for security
      preload: preloadPath, // Preload script to expose safe APIs to renderer
    },
  });

  // Load appropriate content based on development/production mode
  if (process.env.NODE_ENV === 'development') {
    // Development: Load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Production: Load built HTML file
    mainWindow.loadFile(
      path.join(app.getAppPath(), 'dist-renderer/index.html')
    );
  }

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
    // Filter out autofill-related console messages
    mainWindow.webContents.on(
      'console-message',
      (event, level, message, line, sourceId) => {
        // Filter out autofill-related errors by simply not logging them
        if (
          message.includes('Autofill.enable') ||
          message.includes('Autofill.setAddresses')
        ) {
          // Silently ignore autofill messages - they cannot be prevented
          return;
        }
        // For other messages, you can optionally log them to a different location
        // console.log(`[Renderer] ${message}`);
      }
    );
  }

  // Handle window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// Main application initialization
app.whenReady().then(() => {
  // Setup IPC handlers
  setupGeminiHandlers();
  setupScreenshotHandlers();

  // Register global hotkey for screenshot (Option+Space)
  const ret = globalShortcut.register('Alt+Space', () => {
    if (mainWindow) {
      // Send message to renderer to trigger screenshot with auto-append
      mainWindow.webContents.send('global-screenshot-trigger');
    }
  });
  // Create the main window
  createWindow();
});

// Handle macOS app activation (when dock icon is clicked)
app.on('activate', () => {
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
app.on('second-instance', () => {
  // Someone tried to run a second instance, focus our window instead
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up global shortcuts when app is about to quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
