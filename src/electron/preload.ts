/**
 * This script runs in the renderer process context but has access to Node.js APIs.
 * It safely exposes specific Electron APIs to the renderer process through the
 * contextBridge, preventing direct access to the entire ipcRenderer object.
 * Security features:
 * - Uses contextBridge.exposeInMainWorld() for safe API exposure
 * - Only exposes specific methods, not the entire ipcRenderer
 * - Maintains context isolation between main and renderer processes
 */

import { contextBridge, ipcRenderer } from "electron";

console.log("Preload script is loading...");

const electronAPI = {
  sendMessage: (message: string) => ipcRenderer.invoke("gemini:send-message", message),

  sendMessageWithHistory: (messages: any[]) => ipcRenderer.invoke("gemini:send-message-with-history", messages),
};

console.log("Exposing electronAPI:", electronAPI);

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

console.log("Preload script loaded successfully");
