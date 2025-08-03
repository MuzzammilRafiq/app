import { ipcMain } from "electron";
import { promises as fs } from "fs";
import { heicConverter } from "../services/heicConverter.js";

export function setupFileOperationHandlers() {
  ipcMain.handle("read-file-as-buffer", async (event, filePath: string) => {
    try {
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error("Error reading file:", error);
      throw error;
    }
  });

  ipcMain.handle("get-converted-heic-path", async (event, heicPath: string) => {
    try {
      return await heicConverter.getConvertedPath(heicPath);
    } catch (error) {
      console.error("Error converting HEIC:", error);
      return null;
    }
  });

  ipcMain.handle("get-heic-cache-stats", async () => {
    try {
      return await heicConverter.getCacheStats();
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return { fileCount: 0, totalSizeMB: 0 };
    }
  });

  ipcMain.handle("cleanup-heic-cache", async () => {
    try {
      await heicConverter.cleanupCache();
      return { success: true };
    } catch (error) {
      console.error("Error cleaning up cache:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
